import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import api from '@/utils/api';

const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadEventDetails();
    loadPhotos();
    const interval = setInterval(loadStatus, 3000);
    return () => clearInterval(interval);
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      const response = await api.get(`/events/${eventId}`);
      setEvent(response.data);
      await loadStatus();
    } catch (error) {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await api.get(`/events/${eventId}/photos`);
      setPhotos(response.data);
    } catch (error) {
      console.error('Failed to load photos');
    }
  };

  const loadStatus = async () => {
    try {
      const response = await api.get(`/events/${eventId}/status`);
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load status');
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      await api.post(`/events/${eventId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      toast.success(`${files.length} photos uploaded successfully!`);
      await loadPhotos();
      setTimeout(loadEventDetails, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading event...</p>
        </div>
      </div>
    );
  }

  const processingProgress = status ? (status.total_photos > 0 ? (status.processed_photos / status.total_photos) * 100 : 0) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button
            data-testid="back-to-dashboard-button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Event Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 mb-8"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {event?.title}
              </h1>
              {event?.description && (
                <p className="text-slate-600 dark:text-slate-400">{event.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Event Code</div>
              <div className="text-2xl font-mono font-bold text-indigo-600">{event?.event_code}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
              <div className="text-2xl font-bold mb-1">{status?.total_photos || 0}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Photos</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
              <div className="text-2xl font-bold mb-1">{status?.processed_photos || 0}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Processed</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
              <div className="text-2xl font-bold mb-1">{status?.faces_detected || 0}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Faces Detected</div>
            </div>
          </div>
        </motion.div>

        {/* Processing Status */}
        {status && status.status === 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
              <span className="font-semibold text-yellow-800 dark:text-yellow-300">Processing photos...</span>
            </div>
            <Progress value={processingProgress} className="h-2" />
            <div className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
              {status.processed_photos} of {status.total_photos} photos processed
            </div>
          </motion.div>
        )}

        {status && status.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800 dark:text-green-300">
                All photos processed! Event is ready for attendees.
              </span>
            </div>
          </motion.div>
        )}

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8"
        >
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Upload Photos</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Select multiple photos to upload. Face detection and indexing will start automatically.
          </p>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors">
            <input
              data-testid="photo-upload-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="photo-upload"
            />
            <label htmlFor="photo-upload" className="cursor-pointer">
              {uploading ? (
                <div>
                  <Loader2 className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
                  <p className="font-semibold mb-2">Uploading...</p>
                  <Progress value={uploadProgress} className="w-64 mx-auto h-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{uploadProgress}%</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="font-semibold mb-2">Click to upload photos</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">or drag and drop multiple images</p>
                </div>
              )}
            </label>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default EventDetails;
