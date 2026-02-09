import requests
import sys
import json
import time
from datetime import datetime
from pathlib import Path
import io
from PIL import Image

class FaceShotAPITester:
    def __init__(self, base_url="https://faceshot-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.event_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart
                    headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_register_organizer(self):
        """Test organizer registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"organizer_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Test Organizer {timestamp}",
            "role": "organizer"
        }
        
        response = self.run_test("Register Organizer", "POST", "auth/register", 200, user_data)
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_login(self):
        """Test login with registered user"""
        if not self.token:
            return False
            
        # Get user info to test login
        response = self.run_test("Get Current User", "GET", "auth/me", 200)
        return bool(response and 'id' in response)

    def test_create_event(self):
        """Test event creation"""
        event_data = {
            "title": "Test Wedding Event",
            "description": "A beautiful wedding celebration",
            "date": "2024-12-25"
        }
        
        response = self.run_test("Create Event", "POST", "events", 200, event_data)
        if response and 'id' in response:
            self.event_id = response['id']
            print(f"   Event ID: {self.event_id}")
            print(f"   Event Code: {response.get('event_code', 'N/A')}")
            return True
        return False

    def test_get_events(self):
        """Test getting events list"""
        response = self.run_test("Get Events", "GET", "events", 200)
        return bool(response and isinstance(response, list))

    def test_get_event_details(self):
        """Test getting specific event details"""
        if not self.event_id:
            return False
            
        response = self.run_test("Get Event Details", "GET", f"events/{self.event_id}", 200)
        return bool(response and 'id' in response)

    def test_upload_photos(self):
        """Test photo upload functionality"""
        if not self.event_id:
            return False

        # Create a simple test image
        img = Image.new('RGB', (400, 300), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)

        files = {'files': ('test_photo.jpg', img_bytes, 'image/jpeg')}
        
        response = self.run_test("Upload Photos", "POST", f"events/{self.event_id}/upload", 200, 
                               data={}, files=files)
        return bool(response and 'photo_ids' in response)

    def test_processing_status(self):
        """Test processing status endpoint"""
        if not self.event_id:
            return False
            
        response = self.run_test("Get Processing Status", "GET", f"events/{self.event_id}/status", 200)
        return bool(response and 'event_id' in response)

    def test_register_attendee(self):
        """Test attendee registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"attendee_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Test Attendee {timestamp}",
            "role": "attendee"
        }
        
        response = self.run_test("Register Attendee", "POST", "auth/register", 200, user_data)
        return bool(response and 'token' in response)

    def test_event_by_code(self):
        """Test getting event by code (for attendees)"""
        # First get the event to find its code
        if not self.event_id:
            return False
            
        event_response = requests.get(f"{self.base_url}/api/events/{self.event_id}", 
                                    headers={'Authorization': f'Bearer {self.token}'})
        
        if event_response.status_code != 200:
            return False
            
        event_code = event_response.json().get('event_code')
        if not event_code:
            return False
            
        # Test getting event by code (no auth required)
        response = self.run_test("Get Event by Code", "GET", f"events/code/{event_code}", 200)
        return bool(response and 'id' in response)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting FaceShot API Tests")
        print("=" * 50)
        
        # Basic API tests
        self.test_root_endpoint()
        
        # Authentication tests
        if self.test_register_organizer():
            self.test_login()
        
        # Event management tests
        if self.test_create_event():
            self.test_get_events()
            self.test_get_event_details()
            self.test_upload_photos()
            
            # Wait a bit for processing
            print("\n⏳ Waiting 3 seconds for photo processing...")
            time.sleep(3)
            
            self.test_processing_status()
            self.test_event_by_code()
        
        # Attendee tests
        self.test_register_attendee()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = FaceShotAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())