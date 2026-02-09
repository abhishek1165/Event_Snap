import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Webcam from 'react-webcam';
import { Camera, Check, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/utils/api';

const SelfieCapture = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const event = location.state?.event;
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [searching, setSearching] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImgSrc(imageSrc);
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
  };

  const handleSearch = async () => {
    if (!imgSrc) return;
    
    setSearching(true);
    try {
      // Convert base64 to blob
      const response = await fetch(imgSrc);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');
      formData.append('event_id', eventId);
      
      const searchResponse = await api.post('/search/selfie', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const results = searchResponse.data;
      
      if (results.length === 0) {
        toast.error('No photos found. Try a different selfie.');
        setImgSrc(null);
      } else {
        toast.success(`Found ${results.length} photos!`);
        navigate(`/attend/${eventId}/gallery`, { state: { results, event } });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Search failed. Please try again.');
      setImgSrc(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            data-testid="back-button"
            variant="ghost"
            onClick={() => navigate('/attend')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Take Your Selfie
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {event?.title || 'Event'} • Look at the camera and smile!
          </p>
        </motion.div>

        {/* Camera/Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl"
        >
          <div className="relative aspect-[4/3] bg-slate-900">
            {!imgSrc ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  videoConstraints={{
                    facingMode: 'user',
                    width: 1280,
                    height: 720
                  }}
                />
                {/* Scanning overlay animation */}
                <motion.div
                  animate={{
                    y: ['0%', '100%', '0%']
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                  style={{ top: 0 }}
                />
              </>
            ) : (
              <img src={imgSrc} alt="Selfie preview" className="w-full h-full object-cover" />
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-white dark:bg-slate-800">
            {!imgSrc ? (
              <div className="text-center">
                <Button
                  data-testid="capture-button"
                  onClick={capture}
                  size="lg"
                  className="rounded-full w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg p-0"
                >
                  <Camera className="w-8 h-8" />
                </Button>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
                  Click the button to capture
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  data-testid="retake-button"
                  onClick={retake}
                  variant="outline"
                  className="flex-1 h-12 rounded-lg"
                  disabled={searching}
                >
                  Retake
                </Button>
                <Button
                  data-testid="search-button"
                  onClick={handleSearch}
                  className="flex-1 h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                  disabled={searching}
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Search Photos
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800"
        >
          <h3 className="font-semibold mb-3 text-indigo-900 dark:text-indigo-300">Tips for best results:</h3>
          <ul className="space-y-2 text-sm text-indigo-800 dark:text-indigo-300">
            <li>• Face the camera directly</li>
            <li>• Make sure your face is well-lit</li>
            <li>• Remove sunglasses or masks if possible</li>
            <li>• Keep a neutral expression similar to event photos</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

export default SelfieCapture;
