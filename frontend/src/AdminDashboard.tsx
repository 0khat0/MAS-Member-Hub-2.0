import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { getTorontoTime } from './utils';

interface DailyCheckin {
  checkin_id: string;
  email: string;
  name: string;
  timestamp: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  // Password authentication removed - admin access is now open
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'custom'>('week');
  const [startDate, setStartDate] = useState(getTorontoTime());
  const [endDate, setEndDate] = useState(getTorontoTime());
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [checkinData, setCheckinData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [todayCheckins, setTodayCheckins] = useState<DailyCheckin[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Authentication check removed - admin access is now open

  useEffect(() => {
    // Set initial date range
    updateDateRange(dateRange);
    // Fetch today's check-ins
    fetchTodayCheckins();
  }, []);

  useEffect(() => {
    if (dateRange !== 'custom') {
      updateDateRange(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchCheckinData();
    fetchStats();
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    fetchTodayCheckins(); // initial fetch
    const interval = setInterval(() => {
      fetchTodayCheckins();
    }, 3500); // every 3.5 seconds
    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  const fetchTodayCheckins = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/today`);
      const data = await response.json();
      setTodayCheckins(data);
    } catch (error) {
      console.error('Error fetching today\'s check-ins:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto'
    });
  };

  const updateDateRange = (range: 'week' | 'month' | 'year' | 'custom') => {
    const now = getTorontoTime();
    switch (range) {
      case 'week':
        setStartDate(startOfWeek(now));
        setEndDate(endOfWeek(now));
        setGroupBy('day');
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        setGroupBy('day');
        break;
      case 'year':
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        setGroupBy('month');
        break;
    }
  };

  const fetchCheckinData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(
        `${API_URL}/admin/checkins/range?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}&group_by=${groupBy}`
      );
      const data = await response.json();
      setCheckinData(data);
    } catch (error) {
      console.error('Error fetching check-in data:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/members`);
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Login handler removed - admin access is now open

  // Helper to generate a range of dates (days or months) for zero-filling
  function generateDateRange(start: Date, end: Date, group: 'day' | 'month') {
    const range = [];
    let current = new Date(start);
    if (group === 'month') {
      // Set both current and end to the first of their months at midnight
      current = new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
      while (current <= endMonth) {
        range.push(format(current, 'yyyy-MM'));
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Set both current and end to midnight
      current.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (current <= endDay) {
        range.push(format(current, 'yyyy-MM-dd'));
        current.setDate(current.getDate() + 1);
      }
    }
    return range;
  }

  // --- Build processed data with zero-fill using date part only ---
  let processedCheckinData: { date: string, count: number }[] = [];
  if (groupBy === 'month') {
    // Year view: group by month
    const countMap = new Map<string, number>();
    checkinData.forEach(d => {
      // Always use Toronto month for key
      const dDate = new Date(d.date);
      const torontoMonth = dDate.toLocaleString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit' }).slice(0, 7); // YYYY-MM
      countMap.set(torontoMonth, (countMap.get(torontoMonth) || 0) + (d.count || 0));
    });
    const allMonths = generateDateRange(startDate, endDate, 'month');
    processedCheckinData = allMonths.map(monthKey => ({
      date: `${monthKey}-01`, // Use first day of month for chart X axis
      count: countMap.get(monthKey) || 0
    }));
  } else {
    // Week/month view: group by day
    const countMap = new Map<string, number>();
    checkinData.forEach(d => {
      // Always use Toronto date for key
      const dDate = new Date(d.date);
      const torontoDay = dDate.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); // YYYY-MM-DD
      countMap.set(torontoDay, (countMap.get(torontoDay) || 0) + (d.count || 0));
    });
    const allDays = generateDateRange(startDate, endDate, 'day');
    processedCheckinData = allDays.map(dayKey => ({
      date: dayKey,
      count: countMap.get(dayKey) || 0
    }));
  }

  // Login form removed - admin access is now open

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.h1 
          className="text-3xl md:text-4xl font-bold text-white mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          MAS Academy Member Hub - Admin Dashboard
        </motion.h1>

        {/* Debug Timezone Info */}
        <motion.div 
          className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-yellow-500/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="text-center">
            <p className="text-yellow-400 text-sm font-medium mb-2">🌍 Toronto Timezone Debug Info</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/70">
              <div>
                <span className="text-white/50">Date:</span> {getTorontoTime().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
              </div>
              <div>
                <span className="text-white/50">Day:</span> {getTorontoTime().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })}
              </div>
              <div>
                <span className="text-white/50">Time:</span> {getTorontoTime().toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div onClick={() => {
            setShowMembersModal(true);
            fetchMembers();
          }}>
            <StatsCard
              title="Total Members"
              value={stats?.total_members}
              subtitle="All time"
              icon="👥"
              clickable={true}
            />
          </div>
          <StatsCard
            title="Check-ins Today"
            value={stats?.checkins_today}
            subtitle="Today's total"
            icon="📅"
          />
          <StatsCard
            title="Total Check-ins"
            value={stats?.total_checkins}
            subtitle="All time"
            icon="🏆"
          />
        </div>

        {/* Members Modal */}
        <AnimatePresence>
          {showMembersModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowMembersModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-2xl font-semibold text-white">Member List</h2>
                  <button
                    onClick={() => setShowMembersModal(false)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-6 pt-4 pb-2">
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                    autoFocus
                  />
                </div>
                <div className="p-6 overflow-auto max-h-[80vh]">
                  {isLoadingMembers ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.filter(m =>
                          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          m.email.toLowerCase().includes(memberSearch.toLowerCase())
                        ).map((member) => (
                          <tr 
                            key={member.id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4 text-white/90 font-medium">{member.name}</td>
                            <td className="py-3 px-4 text-white/90">{member.email}</td>
                            <td className="py-3 px-4 text-white/90">{formatDate(member.created_at)}</td>
                            <td className="py-3 px-4">
                              <button
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to permanently delete this member? This cannot be undone.')) {
                                    const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
                                    await fetch(`${API_URL}/member/${member.id}`, { method: 'DELETE' });
                                    await fetchMembers(); // Always await to ensure UI is in sync
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today's Check-ins Table */}
        <motion.div 
          className="glass-card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white mb-6">Today's Check-ins</h2>
          <div className="overflow-x-auto">
            {todayCheckins.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70 text-lg">No check-ins yet today</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Time</th>
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {todayCheckins.map((checkin) => (
                    <tr 
                      key={checkin.checkin_id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white/90">{formatTime(checkin.timestamp)}</td>
                      <td className="py-3 px-4 text-white/90 font-medium">{checkin.name}</td>
                      <td className="py-3 px-4 text-white/90">{checkin.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* Date Range Controls - Redesigned */}
        <motion.div 
          className="glass-card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {['week', 'month', 'year', 'custom'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range as any)}
                className={`px-5 py-2 rounded-full font-semibold transition-all duration-200 shadow-sm border-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm
                  ${dateRange === range ? 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-600 scale-105' : 'bg-gray-800 text-white/70 border-gray-700 hover:bg-gray-700'}`}
              >
                {range === 'week' && 'This Week'}
                {range === 'month' && 'This Month'}
                {range === 'year' && 'This Year'}
                {range === 'custom' && 'Custom'}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex flex-wrap gap-4 mb-4 justify-center">
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="input-field"
              />
              <input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="input-field"
              />
            </div>
          )}
        </motion.div>

        {/* Check-in Chart */}
        <motion.div 
          className="glass-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-xl font-semibold text-white mb-6">Check-in Trends</h2>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processedCheckinData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.5)"
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return groupBy === 'month' ? format(d, 'MMM yyyy') : format(d, 'MMM d');
                  }}
                  minTickGap={10}
                />
                <YAxis stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(date) => {
                    const d = new Date(date);
                    return groupBy === 'month' ? format(d, 'MMMM yyyy') : format(d, 'PPP');
                  }}
                  formatter={(value: any) => [`${value} check-in${value === 1 ? '' : 's'}`, '']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Check-ins"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 8 }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  clickable = false 
}: { 
  title: string; 
  value?: number; 
  subtitle: string; 
  icon: string;
  clickable?: boolean;
}) {
  return (
    <motion.div
      className={`glass-card p-6 ${clickable ? 'cursor-pointer hover:bg-white/5' : ''}`}
      whileHover={{ scale: clickable ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg text-white/70">{title}</h3>
          <p className="text-3xl font-bold text-white mt-2">{value ?? '...'}</p>
          <p className="text-sm text-white/50 mt-1">{subtitle}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </motion.div>
  );
}

export default AdminDashboard; 