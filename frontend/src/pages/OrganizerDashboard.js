import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Plus, LogOut, Calendar, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/utils/api';

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: ''
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/events', newEvent);
      toast.success('Event created successfully!');
      setEvents([response.data, ...events]);
      setCreateDialogOpen(false);
      setNewEvent({ title: '', description: '', date: '' });
    } catch (error) {
      toast.error('Failed to create event');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>FaceShot</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">Welcome, {user?.name}</span>
            <Button
              data-testid="logout-button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>My Events</h1>
            <p className="text-slate-600 dark:text-slate-400">Manage your event photos and access codes</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="create-event-button"
                className="gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="event-title">Event Title</Label>
                  <Input
                    data-testid="event-title-input"
                    id="event-title"
                    placeholder="John & Jane's Wedding"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="event-description">Description (Optional)</Label>
                  <Input
                    data-testid="event-description-input"
                    id="event-description"
                    placeholder="Wedding celebration at the Grand Hotel"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="event-date">Event Date (Optional)</Label>
                  <Input
                    data-testid="event-date-input"
                    id="event-date"
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <Button
                  data-testid="create-event-submit-button"
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Event
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>No events yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Create your first event to get started</p>
            <Button
              data-testid="empty-create-event-button"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigate(`/events/${event.id}`)}
                data-testid={`event-card-${event.id}`}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:border-indigo-500/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                    <ImageIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    event.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                    event.status === 'processing' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {event.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {event.title}
                </h3>
                {event.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{event.description}</p>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Code: </span>
                    <span className="font-mono font-semibold text-indigo-600">{event.event_code}</span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {event.total_photos} photos
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrganizerDashboard;
