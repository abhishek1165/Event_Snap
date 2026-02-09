import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PhotoGallery = () => {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const results = location.state?.results || [];
  const event = location.state?.event;

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const handleDownload = async (photoId) => {
    try {
      const url = `${BACKEND_URL}${results.find(r => r.photo_id === photoId)?.photo_url}`;
      window.open(url, '_blank');
      toast.success('Opening photo...');
    } catch (error) {
      toast.error('Failed to download photo');
    }
  };

  if (results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">No results found</p>
          <Button onClick={() => navigate('/attend')}>Try Another Event</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
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
            Back to Events
          </Button>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              {results.length} Photos Found!
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {event?.title || 'Your event'} • Click any photo to view or download
            </p>
          </div>
        </motion.div>

        {/* Masonry Gallery */}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {results.map((result, index) => (
            <motion.div
              key={result.photo_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="break-inside-avoid mb-4 group"
              data-testid={`photo-card-${result.photo_id}`}
            >
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-xl transition-all duration-300">
                <img
                  src={`${BACKEND_URL}${result.thumbnail_url}`}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="text-white">
                      <div className="text-sm font-medium">Similarity</div>
                      <div className="text-xs">{(result.similarity_score * 100).toFixed(0)}%</div>
                    </div>
                    <Button
                      data-testid={`download-button-${result.photo_id}`}
                      size="sm"
                      onClick={() => handleDownload(result.photo_id)}
                      className="gap-2 bg-white text-slate-900 hover:bg-slate-100"
                    >
                      <Download className="w-3 h-3" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700"
        >
          <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Love This?
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create your own event and let guests find their photos instantly
          </p>
          <Button
            data-testid="create-event-cta-button"
            onClick={() => navigate('/auth')}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Create Event
            <ExternalLink className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PhotoGallery;
