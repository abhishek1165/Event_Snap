import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/utils/api';

const AttendeeEntry = () => {
  const navigate = useNavigate();
  const [eventCode, setEventCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.get(`/events/code/${eventCode.toUpperCase()}`);
      const event = response.data;
      
      if (event.status !== 'completed') {
        toast.error('Event is still processing photos. Please try again later.');
        return;
      }
      
      toast.success(`Found event: ${event.title}`);
      navigate(`/attend/${event.id}/selfie`, { state: { event } });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Event not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left side - Info */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 mb-6">
            <Camera className="w-8 h-8 text-indigo-600" />
            <span className="font-bold text-2xl" style={{ fontFamily: 'Outfit, sans-serif' }}>FaceShot</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Find Your Event Photos
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            Enter your event code to get started. You'll take a selfie and instantly see all photos you're in.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 font-semibold flex-shrink-0">
                1
              </div>
              <div className="text-left">
                <p className="font-semibold mb-1">Enter Event Code</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Get the code from your event organizer</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 font-semibold flex-shrink-0">
                2
              </div>
              <div className="text-left">
                <p className="font-semibold mb-1">Take a Selfie</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Quick photo for face recognition</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 font-semibold flex-shrink-0">
                3
              </div>
              <div className="text-left">
                <p className="font-semibold mb-1">Get Your Photos</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Instantly see all photos with your face</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right side - Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-xl"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/20 mb-4">
              <Search className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Enter Event Code</h2>
            <p className="text-slate-600 dark:text-slate-400">Got your code? Let's find your photos!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="event-code">Event Code</Label>
              <Input
                data-testid="event-code-input"
                id="event-code"
                type="text"
                placeholder="e.g., ABC12345"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                className="mt-1.5 h-14 text-center text-2xl font-mono tracking-wider"
                maxLength={8}
                required
              />
            </div>
            <Button
              data-testid="find-photos-button"
              type="submit"
              className="w-full h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              disabled={loading}
            >
              {loading ? 'Finding Event...' : (
                <>
                  Find My Photos
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Don't have a code?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-indigo-600 hover:underline font-medium"
              >
                Contact your organizer
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AttendeeEntry;
