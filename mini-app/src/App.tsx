import React, { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  CheckCircle2,
  Award,
  Settings,
  Trash2,
  X,
  Clock,
  Edit2,
  LogOut,
  Calendar as CalendarIcon
} from 'lucide-react';
import {
  format,
  addDays,
  isSameDay,
  parse,
  addMinutes,
  isAfter
} from 'date-fns';
import { ru } from 'date-fns/locale';

// --- Types ---
interface Service {
  id: string | number;
  name: string;
  price: number;
  duration: number;
  icon: string;
  description: string;
  photo: string;
  subServices?: { name: string, photo: string }[];
}

interface Master {
  id: string | number;
  name: string;
  title: string;
  rating: number;
  photo: string;
}

interface Booking {
  id: number;
  date: string;
  time: string;
  masterId: string | number;
  services: Service[];
  total: number;
  userId?: number;
  clientName?: string;
  masterName?: string;
}

type Step = 'services' | 'masters' | 'calendar' | 'confirmation' | 'success' | 'admin_auth' | 'admin' | 'my_bookings';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('services');
  const [data, setData] = useState<{ services: Service[], masters: Master[], settings: any, bookings: Booking[] }>({
    services: [],
    masters: [],
    settings: {},
    bookings: []
  });
  const [loading, setLoading] = useState(true);

  // User Selection
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 0));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState('');

  // Admin State
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState<'bookings' | 'services' | 'masters' | 'settings'>('bookings');
  const [editingItem, setEditingItem] = useState<any>(null);


  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/data');
      setData(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
    }
  };

  const authenticateAdmin = async () => {
    try {
      const res = await axios.post('/api/data', { action: 'admin_auth', pin: adminPin });
      if (res.data.success) {
        setStep('admin');
      } else {
        WebApp.showAlert('Неверный ПИН-код');
        setAdminPin('');
      }
    } catch (err) {
      WebApp.showAlert('Ошибка авторизации');
      setAdminPin('');
    }
  };

  const logoutAdmin = () => {
    setAdminPin('');
    setStep('services');
  };

  const saveCollection = async (collection: 'services' | 'masters', newData: any[]) => {
    setData(prev => ({ ...prev, [collection]: newData }));
    try {
      await axios.post('/api/data', {
        action: 'save_collection',
        collection,
        data: newData,
        pin: adminPin
      });
      setEditingItem(null);
      WebApp.showAlert('Сохранено');
    } catch (err) {
      WebApp.showAlert('Ошибка сохранения');
    }
  };

  const saveSettings = async (newSettings: any) => {
    setData(prev => ({ ...prev, settings: newSettings }));
    try {
      await axios.post('/api/data', {
        action: 'update_settings',
        data: newSettings,
        pin: adminPin
      });
      WebApp.showAlert('Настройки сохранены');
    } catch (err) {
      WebApp.showAlert('Ошибка сохранения');
    }
  };

  const deleteItem = (collection: 'services' | 'masters', id: string | number) => {
    WebApp.showConfirm('Удалить?', (ok) => {
      if (ok) {
        const filtered = (data as any)[collection].filter((item: any) => item.id !== id);
        saveCollection(collection, filtered);
      }
    });
  };

  const userBookings = useMemo(() => {
    const userId = WebApp.initDataUnsafe?.user?.id;
    const firstName = WebApp.initDataUnsafe?.user?.first_name;

    return data.bookings.filter(b => {
      const matchId = userId && String(b.userId) === String(userId);
      const matchName = firstName && b.clientName === firstName;
      // Fallback for browser testing if not in Telegram
      const isTestMatch = !userId && !firstName && b.clientName === 'Клиент';
      return matchId || matchName || isTestMatch;
    });
  }, [data.bookings]);

  const APP_VERSION = "2.7.1-POLISH";

  const getRussianDayHeader = (day: Date) => {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return days[day.getDay()].toUpperCase();
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const availableTimes = useMemo(() => {
    if (!selectedMaster || !selectedDate) return [];
    const times = [];
    const workStartStr = data.settings?.working_hours?.start || '10:00';
    const workEndStr = data.settings?.working_hours?.end || '21:00';
    const workStart = parse(workStartStr, 'HH:mm', new Date());
    const workEnd = parse(workEndStr, 'HH:mm', new Date());

    let current = workStart;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    while (isAfter(workEnd, current)) {
      const timeStr = format(current, 'HH:mm');
      const isOccupied = data.bookings.some(b => {
        if (String(b.masterId) !== String(selectedMaster.id) || b.date !== dateStr) return false;
        const bStart = parse(b.time, 'HH:mm', new Date());
        const bDur = 60; // Default duration for overlap check
        const bEnd = addMinutes(bStart, bDur);
        return (current < bEnd && addMinutes(current, totalDuration || 30) > bStart);
      });
      if (!isOccupied) times.push(timeStr);
      current = addMinutes(current, 30);
    }
    return times;
  }, [selectedMaster, selectedDate, selectedServices, totalDuration, data.bookings, data.settings]);

  const handleFinalBooking = async () => {
    if (!selectedTime || !selectedMaster) return;
    const bookingData = {
      id: Date.now(),
      userId: WebApp.initDataUnsafe?.user?.id,
      services: selectedServices,
      masterId: selectedMaster.id,
      masterName: selectedMaster.name,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: selectedTime,
      total: totalPrice,
      duration: totalDuration,
      clientName: WebApp.initDataUnsafe?.user?.first_name || 'Клиент',
      clientPhone: clientPhone || 'Не указан'
    };

    try {
      const res = await axios.post('/api/data', { action: 'add_booking', data: bookingData });
      if (res.data.success) {
        setData(prev => ({ ...prev, bookings: res.data.bookings }));
      }
    } catch (err) {
      console.error('Booking sync failed');
    }

    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  const Modal = ({ title, children, onClose }: any) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end justify-center p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-[#1a1b22] w-full max-w-md rounded-[32px] p-8 border border-white/10 overflow-hidden relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0c0d10]">
        <div className="text-accent-gold text-lg font-bold animate-pulse text-glow">RETRÔ...</div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen flex flex-col pb-32">
      {/* Header */}
      <div className="premium-header bg-black/95 backdrop-blur-2xl sticky top-0 z-40 border-b border-white/5">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <h1 className="logo-text truncate">{data.settings?.name?.split(' ')[0]}</h1>
            <div className="bg-accent-gold/10 px-1.5 py-0.5 rounded border border-accent-gold/20 flex-shrink-0">
              <span className="text-[6px] text-accent-gold font-black tracking-tighter">{APP_VERSION}</span>
            </div>
          </div>
          <div className="logo-subtitle truncate">{data.settings?.name?.split(' ').slice(1).join(' ')}</div>
        </div>
        <div className="flex gap-2.5 flex-shrink-0 ml-4">
          <button
            onClick={() => setStep(step === 'my_bookings' ? 'services' : 'my_bookings')}
            className={`header-btn ${step === 'my_bookings' ? 'active' : ''}`}
          >
            <CalendarIcon size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => step === 'admin' ? logoutAdmin() : setStep('admin_auth')}
            className={`header-btn ${step === 'admin' || step === 'admin_auth' ? 'active' : ''}`}
          >
            {step === 'admin' ? <LogOut size={18} strokeWidth={2.5} /> : <Settings size={18} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Услуги</h2>
              <div className="status-badge flex items-center gap-2">
                <Clock size={12} /> {totalDuration} мин
              </div>
            </div>

            <div className="service-grid">
              {data.services.map(s => {
                const isSelected = selectedServices.find(x => x.id === s.id);
                return (
                  <div key={s.id} className={s.subServices && isSelected ? 'col-span-2' : 'col-span-1'}>
                    <div
                      onClick={() => {
                        const exists = selectedServices.find(x => x.id === s.id);
                        if (exists) setSelectedServices(selectedServices.filter(x => x.id !== s.id));
                        else setSelectedServices([...selectedServices, s]);
                      }}
                      className={`glass-card service-card relative group transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-accent-gold' : 'border-white/5'}`}
                    >
                      <div className="service-image-container">
                        <img
                          src={s.photo}
                          className="service-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.style.backgroundColor = '#1a1b22';
                          }}
                        />
                        <div className="service-overlay" />
                        <div className="service-badge text-white font-bold flex items-center gap-1">
                          <span>{s.duration} мин</span>
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-accent-gold/20 flex items-center justify-center backdrop-blur-[2px] z-10 transition-all">
                            <div className="w-12 h-12 bg-accent-gold rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50">
                              <CheckCircle2 className="text-black" size={24} strokeWidth={3} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="service-info text-center p-3 flex flex-col items-center justify-between h-[110px]">
                        <div>
                          <h3 className="service-name text-center text-sm font-black uppercase tracking-wider mb-2 text-accent-gold line-clamp-2 h-[40px] flex items-center justify-center">{s.name}</h3>
                          <p className="text-[9px] text-secondary/60 leading-tight mb-2 line-clamp-2 h-[26px] overflow-hidden w-full">{s.description}</p>
                        </div>
                        <div className="service-price text-lg font-black text-accent-gold text-glow mt-auto">{s.price}₽</div>
                      </div>
                    </div>

                    {/* Sub-services (Hairstyles) Grid */}
                    {s.subServices && isSelected && (
                      <div className="mt-4 mb-4 animate-in fade-in slide-in-from-top-4 space-y-3">
                        <div className="flex items-center gap-4 px-2">
                          <div className="h-[1px] bg-accent-gold/30 flex-1" />
                          <h4 className="text-center text-accent-gold text-[9px] font-black uppercase tracking-[2px]">Выберите стиль</h4>
                          <div className="h-[1px] bg-accent-gold/30 flex-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 px-1">
                          {s.subServices.map((sub, idx) => (
                            <div key={idx} className="glass-card p-0 overflow-hidden group aspect-[4/5] relative rounded-xl border border-white/5">
                              <img src={sub.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                              <div className="absolute bottom-3 inset-x-0 text-center px-1">
                                <span className="text-[9px] font-black text-white uppercase tracking-widest drop-shadow-md block leading-tight">{sub.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button onClick={() => setStep('masters')} className="btn-luxury py-5 px-8 flex justify-between items-center">
                  <span>Выбрать мастера</span>
                  <span className="opacity-40">{totalPrice}₽</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div key="masters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <h2 className="text-2xl font-bold mb-10">Выберите мастера</h2>
            <div className="space-y-6">
              {data.masters.map(m => (
                <div key={m.id} onClick={() => setSelectedMaster(m)} className={`glass-card p-5 flex items-center gap-6 transition-all ${selectedMaster?.id === m.id ? 'selected' : ''}`}>
                  <div className="relative">
                    <img src={m.photo} className="w-24 h-24 rounded-[22px] object-cover shadow-2xl relative z-10" alt={m.name} />
                    <div className="absolute -inset-2 bg-accent-gold/5 blur-xl rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-extrabold text-xl mb-1 tracking-tight">{m.name}</h3>
                    <div className="status-badge py-1 px-3 text-[8px] inline-flex mb-3">
                      {m.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-accent-gold font-black text-sm">
                      <Award size={14} fill="currentColor" />
                      <span>{m.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  {selectedMaster?.id === m.id && (
                    <div className="bg-accent-gold text-black rounded-full p-2 shadow-xl animate-in zoom-in-50 duration-300">
                      <CheckCircle2 size={18} strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedMaster && (
              <div className="sticky-footer">
                <button onClick={() => setStep('calendar')} className="btn-luxury">Продолжить</button>
              </div>
            )}
            <button onClick={() => setStep('services')} className="mt-12 w-full text-secondary/40 text-[10px] font-black uppercase tracking-[3px] text-center">← назад к услугам</button>
          </motion.div>
        )}

        {step === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <h2 className="text-2xl font-bold mb-8">Запись</h2>
            <div className="date-scroller scrollbar-hide">
              {[...Array(21)].map((_, i) => {
                const day = addDays(new Date(), i);
                const active = isSameDay(day, selectedDate);
                return (
                  <div key={i} onClick={() => { setSelectedDate(day); setSelectedTime(null); }} className={`date-item ${active ? 'active' : ''}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">{getRussianDayHeader(day)}</span>
                    <span className="text-xl font-black">{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>
            <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-2xl py-6 px-4 text-accent-gold text-sm font-black uppercase tracking-[2px] my-10 text-center shadow-lg backdrop-blur-md">
              {format(selectedDate, 'd MMMM yyyy г.', { locale: ru })}
            </div>
            <div className="time-grid">
              {availableTimes.length > 0 ? (
                availableTimes.map(t => (
                  <div key={t} onClick={() => setSelectedTime(t)} className={`time-slot ${selectedTime === t ? 'selected' : ''}`}>{t}</div>
                ))
              ) : (
                <div className="col-span-3 py-16 text-center text-secondary/30 border-2 border-dashed border-white/5 rounded-[28px] font-bold text-xs uppercase tracking-widest">Мест нет</div>
              )}
            </div>
            {selectedTime && (
              <div className="sticky-footer">
                <button onClick={() => setStep('confirmation')} className="btn-luxury">Продолжить</button>
              </div>
            )}
            <button onClick={() => setStep('masters')} className="mt-12 w-full text-secondary/40 text-[10px] font-black uppercase tracking-[3px] text-center">← назад к выбору мастера</button>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div key="confirmation" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-6">
            <h2 className="text-2xl font-bold mb-8">Детали записи</h2>
            <div className="glass-card mb-8">
              <div className="p-8 text-center bg-gradient-to-b from-accent-gold/5 to-transparent">
                <div className="w-20 h-20 bg-accent-gold rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-[0_15px_35px_rgba(212,175,55,0.4)]">
                  <CalendarIcon size={32} strokeWidth={2.5} className="text-black" />
                </div>
                <h2 className="text-4xl font-black mb-1 text-glow tracking-tighter">{selectedTime}</h2>
                <p className="text-accent-gold font-bold uppercase tracking-[3px] text-[10px] opacity-60">{format(selectedDate, 'EEEE, d MMMM', { locale: ru })}</p>
              </div>

              <div className="px-8 pb-8 space-y-6">
                <div className="border-t border-white/5 pt-6 text-center">
                  <span className="text-secondary/40 text-[10px] uppercase font-black tracking-widest block mb-2">Мастер</span>
                  <span className="text-white font-bold text-sm underline decoration-accent-gold/30 underline-offset-4">{selectedMaster?.name}</span>
                </div>

                <div className="text-center">
                  <span className="text-secondary/40 text-[10px] uppercase font-black tracking-widest block mb-2">Услуги</span>
                  <div className="space-y-1">
                    {selectedServices.map(s => <div key={s.id} className="text-white font-bold text-xs">{s.name}</div>)}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 text-center">
                  <span className="text-secondary/40 text-[10px] uppercase font-black tracking-widest block mb-4">Подтвердите ваш номер телефона</span>
                  <input
                    type="tel"
                    placeholder="+7 999 999 99 99"
                    className="admin-input w-full text-center"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                  <p className="text-[8px] text-secondary/30 uppercase font-bold mt-2 tracking-widest">необходим для подтверждения записи</p>
                </div>

                <div className="border-t border-white/5 pt-6 text-center">
                  <span className="text-secondary/40 text-[10px] uppercase font-black tracking-widest block mb-1">К оплате</span>
                  <span className="text-accent-gold font-black text-2xl text-glow">{totalPrice}₽</span>
                </div>
              </div>
            </div>
            <div className="sticky-footer">
              <button
                onClick={handleFinalBooking}
                disabled={clientPhone.length < 10}
                className={`btn-luxury ${clientPhone.length < 10 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                Подтвердить запись
              </button>
            </div>
            <button onClick={() => setStep('calendar')} className="mt-8 w-full text-secondary/40 text-[10px] font-black uppercase tracking-[3px] text-center">назад к календарю</button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 text-center flex flex-col items-center justify-center min-h-[70vh]">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-accent-gold/20 blur-[60px] rounded-full" />
              <div className="w-32 h-32 bg-accent-gold rounded-[40px] flex items-center justify-center relative shadow-[0_20px_50px_rgba(212,175,55,0.4)]">
                <CheckCircle2 size={64} strokeWidth={3} className="text-black" />
              </div>
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tighter">Готово!</h2>
            <p className="text-secondary font-medium text-base mb-16 max-w-[200px]">Мы ждем вас в<br /><span className="text-accent-gold font-bold">{data.settings?.name}</span></p>
            <button onClick={() => { setStep('services'); setSelectedServices([]); setSelectedMaster(null); setSelectedTime(null); }} className="btn-luxury">На главную</button>
          </motion.div>
        )}

        {step === 'admin_auth' && (
          <motion.div key="auth" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-xs mx-auto text-center">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10">
              <Settings className="text-accent-gold" />
            </div>
            <h2 className="text-xl font-bold mb-8 uppercase tracking-widest">Админ-панель</h2>
            <input type="password" placeholder="PIN" className="admin-input text-center text-2xl tracking-[10px]" value={adminPin} onChange={e => setAdminPin(e.target.value)} />
            <button onClick={authenticateAdmin} className="btn-luxury mt-4">Войти</button>
            <button onClick={() => setStep('services')} className="mt-8 w-full text-secondary text-[10px] font-bold uppercase tracking-widest opacity-30">Отмена</button>
          </motion.div>
        )}

        {step === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <div className="flex gap-2 overflow-x-auto mb-10 scrollbar-hide py-2">
              {['bookings', 'services', 'masters', 'settings'].map(tab => (
                <button key={tab} onClick={() => { setAdminTab(tab as any); setEditingItem(null); }} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${adminTab === tab ? 'bg-accent-gold text-black' : 'bg-white/5 text-secondary border border-white/10'}`}>
                  {tab === 'bookings' ? 'ЗАПИСИ' : tab === 'services' ? 'УСЛУГИ' : tab === 'masters' ? 'МАСТЕРА' : 'НАСТРОЙКИ'}
                </button>
              ))}
            </div>

            {adminTab === 'bookings' && (
              <div className="space-y-4">
                {[...data.bookings].sort((a, b) => b.id - a.id).map(b => (
                  <div key={b.id} className="glass-card p-5 border-l-2 border-accent-gold">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xl font-black text-accent-gold">{b.time}</div>
                        <div className="text-[10px] font-bold text-secondary uppercase">{b.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{b.clientName}</div>
                        <div className="text-[8px] opacity-40 uppercase font-black">{b.masterName}</div>
                      </div>
                    </div>
                    <div className="text-[10px] opacity-50 border-t border-white/5 pt-2">
                      {b.services?.map((s: any, i) => <span key={i}>{typeof s === 'string' ? s : s.name}{i < b.services.length - 1 ? ', ' : ''}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'services' && (
              <div className="space-y-4">
                <button onClick={() => setEditingItem({ id: Date.now(), name: '', price: 1000, duration: 30, icon: '✂️', photo: '' })} className="w-full py-4 border border-dashed border-accent-gold/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-accent-gold">Добавить услугу</button>
                {data.services.map(s => (
                  <div key={s.id} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={s.photo} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="font-bold text-xs">{s.name}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingItem(s)} className="p-2 bg-white/5 rounded-lg text-secondary"><Edit2 size={14} /></button>
                      <button onClick={() => deleteItem('services', s.id)} className="p-2 bg-white/5 rounded-lg text-red-500/50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'masters' && (
              <div className="space-y-4">
                <button onClick={() => setEditingItem({ id: Date.now(), name: '', title: 'Barber', rating: 5.0, photo: '' })} className="w-full py-4 border border-dashed border-accent-gold/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-accent-gold">Добавить мастера</button>
                {data.masters.map(m => (
                  <div key={m.id} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={m.photo} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-bold text-xs">{m.name}</div>
                        <div className="text-[8px] opacity-40 uppercase">{m.title}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingItem(m)} className="p-2 bg-white/5 rounded-lg text-secondary"><Edit2 size={14} /></button>
                      <button onClick={() => deleteItem('masters', m.id)} className="p-2 bg-white/5 rounded-lg text-red-500/50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="space-y-4">
                <div className="glass-card p-6 space-y-4">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-2 block">Название барбершопа</label>
                    <input className="admin-input" value={data.settings?.name} onChange={e => saveSettings({ ...data.settings, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-2 block">Адрес</label>
                    <input className="admin-input" value={data.settings?.address} onChange={e => saveSettings({ ...data.settings, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-2 block">Телефон</label>
                    <input className="admin-input" value={data.settings?.phone} onChange={e => saveSettings({ ...data.settings, phone: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {editingItem && (
              <Modal title="Редактировать" onClose={() => setEditingItem(null)}>
                <div className="space-y-3">
                  <input className="admin-input" placeholder="Название" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                  <input className="admin-input" placeholder="Цена" type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })} />
                  <input className="admin-input" placeholder="URL фото" value={editingItem.photo} onChange={e => setEditingItem({ ...editingItem, photo: e.target.value })} />
                  <button onClick={() => {
                    const exists = (data as any)[adminTab].find((x: any) => x.id === editingItem.id);
                    const newList = exists ? (data as any)[adminTab].map((x: any) => x.id === editingItem.id ? editingItem : x) : [...(data as any)[adminTab], editingItem];
                    saveCollection(adminTab as any, newList);
                  }} className="btn-luxury mt-4">Сохранить</button>
                </div>
              </Modal>
            )}
          </motion.div>
        )}

        {step === 'my_bookings' && (
          <motion.div key="my_bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 mb-20">
            <h2 className="text-2xl font-bold mb-10">Мои записи</h2>
            {userBookings.length === 0 ? (
              <div className="py-32 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-[30px] flex items-center justify-center mx-auto mb-6 border border-white/5">
                  <CalendarIcon size={32} className="text-white/20" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-[4px] text-white/20">Нет активных записей</p>
              </div>
            ) : (
              <div className="space-y-6">
                {userBookings.map(b => (
                  <div key={b.id} className="glass-card booking-card mb-6">
                    <div className="text-2xl font-black text-white mb-2">{b.time}</div>
                    <div className="status-badge py-1 px-3 text-[9px] mb-4">{format(parse(b.date, 'yyyy-MM-dd', new Date()), 'd MMMM', { locale: ru })}</div>
                    <div className="font-bold text-sm text-accent-gold mb-1">{b.masterName}</div>
                    <div className="text-[10px] text-white/40 font-black uppercase tracking-widest">{b.total}₽</div>
                  </div>
                ))}
              </div>
            )}
            <div className="fixed bottom-10 left-6 right-6 z-50">
              <button onClick={() => setStep('services')} className="btn-luxury opacity-90 backdrop-blur-md">На главную</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
