from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import aiofiles
from deepface import DeepFace
import numpy as np
import faiss
import pickle
import cv2
from PIL import Image
import io
import secrets
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Storage setup
STORAGE_DIR = Path("/app/storage")
PHOTOS_DIR = STORAGE_DIR / "photos"
THUMBNAILS_DIR = STORAGE_DIR / "thumbnails"
FAISS_DIR = STORAGE_DIR / "faiss_indices"

for directory in [PHOTOS_DIR, THUMBNAILS_DIR, FAISS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# In-memory FAISS indices (event_id -> index)
faiss_indices = {}
face_mappings = {}  # event_id -> {face_id -> [photo_ids]}

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "attendee"  # organizer or attendee

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: Optional[str] = None

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    organizer_id: str
    title: str
    description: Optional[str] = None
    event_code: str
    date: Optional[str] = None
    status: str = "active"  # active, processing, completed
    total_photos: int = 0
    processed_photos: int = 0
    faces_detected: int = 0
    created_at: datetime

class Photo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    event_id: str
    file_path: str
    thumbnail_path: str
    upload_status: str = "uploaded"  # uploaded, processing, completed, failed
    processed: bool = False
    faces_detected: int = 0
    created_at: datetime

class FaceEmbedding(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    photo_id: str
    event_id: str
    face_id: str
    bbox: List[float]
    created_at: datetime

class SearchResult(BaseModel):
    photo_id: str
    event_id: str
    similarity_score: float
    thumbnail_url: str
    photo_url: str

class ProcessingStatus(BaseModel):
    event_id: str
    total_photos: int
    processed_photos: int
    faces_detected: int
    status: str

# ==================== AUTH UTILS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== FACE PROCESSING ====================

def generate_thumbnail(image_path: str, thumbnail_path: str, size=(300, 300)):
    """Generate thumbnail for an image"""
    try:
        img = Image.open(image_path)
        img.thumbnail(size, Image.Resampling.LANCZOS)
        img.save(thumbnail_path, "JPEG", quality=85)
        return True
    except Exception as e:
        logging.error(f"Error generating thumbnail: {e}")
        return False

async def process_photo_faces(photo_id: str, event_id: str, image_path: str):
    """Detect faces and generate embeddings for a photo"""
    try:
        # Detect faces using DeepFace
        faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend='opencv',
            enforce_detection=False
        )
        
        if not faces:
            logging.info(f"No faces detected in photo {photo_id}")
            return []
        
        face_embeddings = []
        
        for idx, face_data in enumerate(faces):
            if face_data.get('confidence', 0) < 0.5:
                continue
                
            # Generate embedding
            face_region = face_data['facial_area']
            embedding_result = DeepFace.represent(
                img_path=image_path,
                model_name='Facenet',
                detector_backend='skip',
                enforce_detection=False
            )
            
            if embedding_result:
                embedding = np.array(embedding_result[0]['embedding'])
                
                # Create face embedding document
                face_id = str(uuid.uuid4())
                bbox = [face_region['x'], face_region['y'], face_region['w'], face_region['h']]
                
                face_doc = {
                    'id': face_id,
                    'photo_id': photo_id,
                    'event_id': event_id,
                    'face_id': face_id,
                    'bbox': bbox,
                    'embedding': embedding.tolist(),
                    'created_at': datetime.now(timezone.utc).isoformat()
                }
                
                await db.face_embeddings.insert_one(face_doc)
                face_embeddings.append((face_id, embedding))
        
        return face_embeddings
        
    except Exception as e:
        logging.error(f"Error processing photo faces: {e}")
        return []

async def build_faiss_index(event_id: str):
    """Build FAISS index for an event"""
    try:
        # Get all face embeddings for this event
        embeddings_cursor = db.face_embeddings.find({"event_id": event_id}, {"_id": 0})
        embeddings_list = await embeddings_cursor.to_list(None)
        
        if not embeddings_list:
            logging.info(f"No embeddings found for event {event_id}")
            return
        
        # Extract embeddings and face IDs
        face_ids = []
        embeddings = []
        photo_map = {}  # face_id -> photo_id
        
        for emb_doc in embeddings_list:
            face_ids.append(emb_doc['face_id'])
            embeddings.append(emb_doc['embedding'])
            photo_map[emb_doc['face_id']] = emb_doc['photo_id']
        
        embeddings_array = np.array(embeddings).astype('float32')
        
        # Create FAISS index
        dimension = embeddings_array.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(embeddings_array)
        
        # Store in memory
        faiss_indices[event_id] = index
        face_mappings[event_id] = {
            'face_ids': face_ids,
            'photo_map': photo_map
        }
        
        # Save to disk
        index_path = FAISS_DIR / f"{event_id}.index"
        mapping_path = FAISS_DIR / f"{event_id}.pkl"
        
        faiss.write_index(index, str(index_path))
        with open(mapping_path, 'wb') as f:
            pickle.dump({'face_ids': face_ids, 'photo_map': photo_map}, f)
        
        logging.info(f"FAISS index built for event {event_id} with {len(embeddings)} faces")
        
    except Exception as e:
        logging.error(f"Error building FAISS index: {e}")

async def search_faces(event_id: str, query_embedding: np.ndarray, k: int = 50) -> List[SearchResult]:
    """Search for similar faces in an event"""
    try:
        # Load index if not in memory
        if event_id not in faiss_indices:
            index_path = FAISS_DIR / f"{event_id}.index"
            mapping_path = FAISS_DIR / f"{event_id}.pkl"
            
            if not index_path.exists():
                return []
            
            faiss_indices[event_id] = faiss.read_index(str(index_path))
            with open(mapping_path, 'rb') as f:
                face_mappings[event_id] = pickle.load(f)
        
        index = faiss_indices[event_id]
        mapping = face_mappings[event_id]
        
        # Search
        query_array = query_embedding.reshape(1, -1).astype('float32')
        distances, indices = index.search(query_array, k)
        
        # Get unique photos
        seen_photos = set()
        results = []
        
        for idx, distance in zip(indices[0], distances[0]):
            if idx == -1:
                continue
            
            face_id = mapping['face_ids'][idx]
            photo_id = mapping['photo_map'][face_id]
            
            if photo_id in seen_photos:
                continue
            
            seen_photos.add(photo_id)
            
            # Get photo details
            photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
            if photo:
                similarity_score = float(1.0 / (1.0 + distance))  # Convert distance to similarity
                results.append(SearchResult(
                    photo_id=photo_id,
                    event_id=event_id,
                    similarity_score=similarity_score,
                    thumbnail_url=f"/api/photos/{photo_id}/thumbnail",
                    photo_url=f"/api/photos/{photo_id}"
                ))
        
        return results
        
    except Exception as e:
        logging.error(f"Error searching faces: {e}")
        return []

# ==================== API ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': user.email,
        'password_hash': hash_password(user.password),
        'name': user.name,
        'role': user.role,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    
    return {
        'token': token,
        'user': {
            'id': user_id,
            'email': user.email,
            'name': user.name,
            'role': user.role
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user['id']})
    
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role']
        }
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/events", response_model=Event)
async def create_event(event: EventCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "organizer":
        raise HTTPException(status_code=403, detail="Only organizers can create events")
    
    event_id = str(uuid.uuid4())
    event_code = secrets.token_urlsafe(8).upper()[:8]
    
    event_doc = {
        'id': event_id,
        'organizer_id': current_user.id,
        'title': event.title,
        'description': event.description,
        'event_code': event_code,
        'date': event.date,
        'status': 'active',
        'total_photos': 0,
        'processed_photos': 0,
        'faces_detected': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.events.insert_one(event_doc)
    
    event_doc['created_at'] = datetime.fromisoformat(event_doc['created_at'])
    return Event(**event_doc)

@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: User = Depends(get_current_user)):
    query = {"organizer_id": current_user.id} if current_user.role == "organizer" else {}
    events = await db.events.find(query, {"_id": 0}).to_list(1000)
    
    for event in events:
        if isinstance(event['created_at'], str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    
    return events

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str, current_user: User = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if isinstance(event['created_at'], str):
        event['created_at'] = datetime.fromisoformat(event['created_at'])
    
    return Event(**event)

@api_router.get("/events/code/{event_code}", response_model=Event)
async def get_event_by_code(event_code: str):
    event = await db.events.find_one({"event_code": event_code.upper()}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if isinstance(event['created_at'], str):
        event['created_at'] = datetime.fromisoformat(event['created_at'])
    
    return Event(**event)

@api_router.post("/events/{event_id}/upload")
async def upload_photos(
    event_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event['organizer_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    uploaded_photos = []
    
    for file in files:
        photo_id = str(uuid.uuid4())
        file_extension = file.filename.split('.')[-1]
        
        # Save photo
        photo_filename = f"{photo_id}.{file_extension}"
        photo_path = PHOTOS_DIR / photo_filename
        
        async with aiofiles.open(photo_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Generate thumbnail
        thumbnail_filename = f"{photo_id}_thumb.jpg"
        thumbnail_path = THUMBNAILS_DIR / thumbnail_filename
        generate_thumbnail(str(photo_path), str(thumbnail_path))
        
        # Save to database
        photo_doc = {
            'id': photo_id,
            'event_id': event_id,
            'file_path': str(photo_path),
            'thumbnail_path': str(thumbnail_path),
            'upload_status': 'uploaded',
            'processed': False,
            'faces_detected': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.photos.insert_one(photo_doc)
        uploaded_photos.append(photo_id)
    
    # Update event stats
    await db.events.update_one(
        {"id": event_id},
        {"$inc": {"total_photos": len(files)}}
    )
    
    # Start processing in background
    asyncio.create_task(process_event_photos(event_id))
    
    return {
        'message': f'{len(files)} photos uploaded successfully',
        'photo_ids': uploaded_photos
    }

async def process_event_photos(event_id: str):
    """Background task to process all photos in an event"""
    try:
        # Update event status
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"status": "processing"}}
        )
        
        # Get all unprocessed photos
        photos = await db.photos.find(
            {"event_id": event_id, "processed": False},
            {"_id": 0}
        ).to_list(None)
        
        for photo in photos:
            try:
                # Process faces
                face_embeddings = await process_photo_faces(
                    photo['id'],
                    event_id,
                    photo['file_path']
                )
                
                # Update photo
                await db.photos.update_one(
                    {"id": photo['id']},
                    {
                        "$set": {
                            "processed": True,
                            "faces_detected": len(face_embeddings),
                            "upload_status": "completed"
                        }
                    }
                )
                
                # Update event stats
                await db.events.update_one(
                    {"id": event_id},
                    {
                        "$inc": {
                            "processed_photos": 1,
                            "faces_detected": len(face_embeddings)
                        }
                    }
                )
                
            except Exception as e:
                logging.error(f"Error processing photo {photo['id']}: {e}")
                await db.photos.update_one(
                    {"id": photo['id']},
                    {"$set": {"upload_status": "failed"}}
                )
        
        # Build FAISS index
        await build_faiss_index(event_id)
        
        # Update event status
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"status": "completed"}}
        )
        
    except Exception as e:
        logging.error(f"Error processing event photos: {e}")
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"status": "failed"}}
        )

@api_router.get("/events/{event_id}/status", response_model=ProcessingStatus)
async def get_processing_status(event_id: str, current_user: User = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return ProcessingStatus(
        event_id=event_id,
        total_photos=event['total_photos'],
        processed_photos=event['processed_photos'],
        faces_detected=event['faces_detected'],
        status=event['status']
    )

@api_router.get("/events/{event_id}/photos", response_model=List[Photo])
async def get_event_photos(event_id: str, current_user: User = Depends(get_current_user)):
    photos = await db.photos.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    
    for photo in photos:
        if isinstance(photo['created_at'], str):
            photo['created_at'] = datetime.fromisoformat(photo['created_at'])
    
    return photos

@api_router.post("/search/selfie", response_model=List[SearchResult])
async def search_by_selfie(
    event_id: str = Form(...),
    file: UploadFile = File(...)
):
    # Verify event exists
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Event processing not completed")
    
    try:
        # Save temporary selfie
        selfie_path = STORAGE_DIR / f"temp_{uuid.uuid4()}.jpg"
        async with aiofiles.open(selfie_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Generate embedding from selfie
        embedding_result = DeepFace.represent(
            img_path=str(selfie_path),
            model_name='Facenet',
            detector_backend='opencv',
            enforce_detection=False
        )
        
        if not embedding_result:
            raise HTTPException(status_code=400, detail="No face detected in selfie")
        
        query_embedding = np.array(embedding_result[0]['embedding'])
        
        # Search for similar faces
        results = await search_faces(event_id, query_embedding, k=50)
        
        # Clean up
        selfie_path.unlink()
        
        return results
        
    except Exception as e:
        logging.error(f"Error searching by selfie: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/photos/{photo_id}")
async def get_photo(photo_id: str):
    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return FileResponse(photo['file_path'])

@api_router.get("/photos/{photo_id}/thumbnail")
async def get_photo_thumbnail(photo_id: str):
    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return FileResponse(photo['thumbnail_path'])

@api_router.get("/")
async def root():
    return {"message": "FaceShot API"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()