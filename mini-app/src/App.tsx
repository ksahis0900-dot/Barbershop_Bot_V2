import React, { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronRight,
  Award,
  Settings,
  Plus,
  Trash2,
  ChevronLeft,
  X,
  Clock,
  MapPin,
  Edit2,
  LogOut,
  Save,
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
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  masterId: string | number;
  services: Service[];
  total: number;
  clientName?: string;
  masterName?: string;
}

type Step = 'services' | 'masters' | 'calendar' | 'confirmation' | 'success' | 'admin_auth' | 'admin';

const App: React.FC = () => {
  // State
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
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 0)); // Today is a good start
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Admin State
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState<'bookings' | 'services' | 'masters' | 'settings'>('bookings');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Initialization
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
      WebApp.showAlert('Ошибка авторизации. Проверьте подключение.');
      setAdminPin('');
    }
  };

  const logoutAdmin = () => {
    setAdminPin('');
    setStep('services');
  };

  // --- Admin CRUD ---
  const saveCollection = async (collection: 'services' | 'masters', newData: any[]) => {
    // Update local state immediately for instant feedback
    setData(prev => ({ ...prev, [collection]: newData }));

    try {
      await axios.post('/api/data', {
        action: 'save_collection',
        collection,
        data: newData,
        pin: adminPin
      });
      // Optionally re-fetch to ensure sync, but keep local state for Vercel persistence mock
      // fetchData(); 
      setEditingItem(null);
      WebApp.showAlert('Сохранено локально');
    } catch (err) {
      WebApp.showAlert('Ошибка сохранения на сервере');
    }
  };

  const deleteItem = (collection: 'services' | 'masters', id: string | number) => {
    WebApp.showConfirm('Вы уверены, что хотите удалить?', (ok) => {
      if (ok) {
        const filtered = (data as any)[collection].filter((item: any) => item.id !== id);
        saveCollection(collection, filtered);
      }
    });
  };

  // --- Date Logic ---
  const getRussianDayHeader = (day: Date) => {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return days[day.getDay()].toUpperCase();
  };

  // --- Logic ---
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
        const bDur = b.services?.reduce((sum, s) => sum + s.duration, 0) || 60;
        const bEnd = addMinutes(bStart, bDur);
        const slotStart = current;
        const slotEnd = addMinutes(current, totalDuration || 30);
        return (slotStart < bEnd && slotEnd > bStart);
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
      services: selectedServices,
      master: selectedMaster,
      masterId: selectedMaster.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: selectedTime,
      total: totalPrice,
      duration: totalDuration,
      clientName: WebApp.initDataUnsafe?.user?.first_name || 'Клиент'
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

  // --- Shared Components ---
  const Modal = ({ title, children, onClose }: any) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-[#1a1b22] w-full max-w-md rounded-[32px] p-8 border border-white/10 overflow-hidden relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={20} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );

  // --- Views ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0c0d10]">
        <div className="text-accent-gold text-lg font-bold animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container p-0 max-w-lg mx-auto overflow-x-hidden min-h-screen pb-32">
      {/* Header */}
      <div className="px-6 pt-8 flex justify-between items-center bg-[#0c0d10] sticky top-0 z-40">
        <div>
          <h1 className="logo-text text-2xl tracking-[2px]">{data.settings?.name?.split(' ')[0]}</h1>
          <div className="logo-subtitle text-[8px] tracking-[4px]">{data.settings?.name?.split(' ')[1]}</div>
        </div>
        <button
          onClick={() => step === 'admin' ? logoutAdmin() : setStep('admin_auth')}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-secondary active:scale-95 transition-all"
        >
          {step === 'admin' ? <LogOut size={22} /> : <Settings size={22} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Услуги</h2>
              <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-accent-gold flex items-center gap-2">
                <Clock size={12} /> {totalDuration} мин
              </div>
            </div>

            <div className="space-y-6">
              {data.services.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    const exists = selectedServices.find(x => x.id === s.id);
                    if (exists) setSelectedServices(selectedServices.filter(x => x.id !== s.id));
                    else setSelectedServices([...selectedServices, s]);
                  }}
                  className={`glass-card p-0 relative group transition-all duration-500 ${selectedServices.find(x => x.id === s.id) ? 'selected border-accent-gold' : ''}`}
                >
                  <div className="h-48 overflow-hidden">
                    <img src={s.photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-accent-gold font-black uppercase tracking-[3px] mb-2">{s.icon} Service</div>
                        <h3 className="text-xl font-bold">{s.name}</h3>
                      </div>
                      <div className="price-text text-2xl">{s.price}₽</div>
                    </div>
                  </div>
                  {selectedServices.find(x => x.id === s.id) && (
                    <div className="absolute top-5 right-5 bg-accent-gold text-black rounded-full p-1 shadow-xl">
                      <CheckCircle2 size={24} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button onClick={() => setStep('masters')} className="btn-luxury py-6 text-base flex justify-between px-10">
                  <span>Выбрать мастера</span>
                  <span className="opacity-50 font-medium">{totalPrice}₽</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div key="masters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6">
            <h2 className="text-2xl font-bold mb-8">Мастер</h2>
            <div className="grid grid-cols-1 gap-6">
              {data.masters.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMaster(m)}
                  className={`glass-card p-5 flex items-center gap-6 transition-all border-2 ${selectedMaster?.id === m.id ? 'border-accent-gold bg-accent-gold/5' : 'border-transparent'}`}
                >
                  <img src={m.photo} className="w-24 h-24 rounded-3xl object-cover shadow-2xl" />
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">{m.name}</h3>
                    <div className="text-secondary text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Award size={14} className="text-accent-gold" /> {m.title}
                    </div>
                    <div className="text-accent-gold text-sm font-bold">★ {m.rating}</div>
                  </div>
                </div>
              ))}
            </div>
            {selectedMaster && (
              <div className="sticky-footer">
                <button onClick={() => setStep('calendar')} className="btn-luxury py-6">Продолжить</button>
              </div>
            )}
            <button onClick={() => setStep('services')} className="mt-8 w-full text-secondary text-xs font-bold uppercase tracking-widest opacity-50">Назад</button>
          </motion.div>
        )}

        {step === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <h2 className="text-2xl font-bold mb-8">Дата и время</h2>

            <div className="date-scroller scrollbar-hide mb-10">
              {[...Array(30)].map((_, i) => {
                const day = addDays(new Date(), i);
                const active = isSameDay(day, selectedDate);
                return (
                  <div key={i} onClick={() => { setSelectedDate(day); setSelectedTime(null); }} className={`date-item min-w-[100px] h-[110px] ${active ? 'active' : ''}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">
                      {getRussianDayHeader(day)}
                    </span>
                    <span className="text-2xl font-black">{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>

            <div className="mb-6">
              <div className="text-secondary text-[11px] font-black uppercase tracking-[3px] mb-4 text-center">
                {format(selectedDate, 'd MMMM yyyy года', { locale: ru })}
              </div>
              <div className="time-grid">
                {availableTimes.length > 0 ? (
                  availableTimes.map(t => (
                    <div key={t} onClick={() => setSelectedTime(t)} className={`time-slot h-16 ${selectedTime === t ? 'selected' : ''}`}>
                      {t}
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 py-12 text-center text-secondary border-2 border-dashed border-white/5 rounded-3xl font-bold">Нет свободных мест</div>
                )}
              </div>
            </div>

            {selectedTime && (
              <div className="sticky-footer">
                <button onClick={() => setStep('confirmation')} className="btn-luxury py-6">Записаться</button>
              </div>
            )}
            <button onClick={() => setStep('masters')} className="mt-8 w-full text-secondary text-xs font-bold uppercase tracking-widest opacity-50 text-center">Назад</button>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div key="confirmation" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-6 text-center">
            <div className="glass-card mb-10 p-10">
              <div className="w-20 h-20 bg-accent-gold rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(197,166,118,0.4)]">
                <CalendarIcon size={32} className="text-black" />
              </div>
              <h2 className="text-3xl font-black mb-4">{selectedTime}</h2>
              <p className="text-secondary font-bold uppercase tracking-widest text-[11px] mb-10">
                {format(selectedDate, 'EEEE, d MMMM yyyy года', { locale: ru })}
              </p>

              <div className="space-y-4 text-left border-t border-white/10 pt-8">
                <div className="flex justify-between items-center">
                  <span className="text-secondary text-xs font-bold uppercase tracking-widest">Мастер:</span>
                  <span className="font-bold">{selectedMaster?.name}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-secondary text-xs font-bold uppercase tracking-widest">Услуги:</span>
                  <div className="text-right flex flex-col items-end">
                    {selectedServices.map(s => <span key={s.id} className="font-bold text-sm">{s.name}</span>)}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <span className="text-accent-gold text-xs font-black uppercase tracking-widest">К оплате:</span>
                  <span className="text-2xl font-black">{totalPrice}₽</span>
                </div>
              </div>
            </div>

            <button onClick={handleFinalBooking} className="btn-luxury py-7 text-lg">Подтвердить</button>
            <button onClick={() => setStep('calendar')} className="mt-8 text-secondary text-xs font-bold uppercase tracking-widest opacity-40">Назад</button>
          </motion.div>
        )}

        {step === 'success' && (
          <div className="p-8 text-center pt-24">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="mb-12 relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-accent-gold rounded-full blur-2xl opacity-20" />
              <CheckCircle2 size={128} className="text-accent-gold relative" />
            </motion.div>
            <h2 className="text-4xl font-black mb-4">УСПЕШНО!</h2>
            <p className="text-secondary mb-12 text-sm max-w-[200px] mx-auto leading-loose">Мы ждем вас в Retro Barbershop в назначенное время.</p>
            <button onClick={() => WebApp.close()} className="btn-luxury py-6">Закрыть</button>
          </div>
        )}

        {step === 'admin_auth' && (
          <motion.div key="admin_auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 pt-24">
            <div className="glass-card p-10 text-center">
              <Settings size={48} className="text-accent-gold mx-auto mb-8 animate-spin-slow" />
              <h3 className="text-2xl font-bold mb-8">Доступ ограничен</h3>
              <input
                type="password"
                autoFocus
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                placeholder="PIN"
                className="w-full bg-black/40 border-2 border-white/10 p-6 rounded-3xl text-center text-4xl tracking-[20px] font-black outline-none focus:border-accent-gold transition-all"
              />
              <button onClick={authenticateAdmin} className="btn-luxury mt-8 py-6">Войти</button>
              <button onClick={() => setStep('services')} className="mt-6 text-secondary text-xs font-bold uppercase tracking-widest opacity-40">Отмена</button>
            </div>
          </motion.div>
        )}

        {step === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <div className="flex gap-2 overflow-x-auto mb-10 scrollbar-hide py-2">
              {['bookings', 'services', 'masters', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setAdminTab(tab as any); setEditingItem(null); }}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[2px] whitespace-nowrap border-2 transition-all ${adminTab === tab ? 'bg-accent-gold border-accent-gold text-black shadow-[0_5px_15px_rgba(197,166,118,0.3)]' : 'bg-white/5 border-white/10 text-secondary'}`}
                >
                  {tab === 'bookings' ? 'ЗАПИСИ' : tab === 'services' ? 'УСЛУГИ' : tab === 'masters' ? 'МАСТЕРА' : 'ОФИС'}
                </button>
              ))}
            </div>

            {adminTab === 'bookings' && (
              <div className="space-y-6">
                {[...data.bookings].sort((a, b) => b.id - a.id).map(b => (
                  <div key={b.id} className="glass-card p-6 border-l-4 border-accent-gold bg-white/[0.02]">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-2xl font-black text-accent-gold mb-1">{b.time}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">{format(parse(b.date, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy', { locale: ru })}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg mb-1">{b.clientName}</div>
                        <div className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full text-secondary uppercase font-bold tracking-widest">{b.masterName}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 py-4 border-t border-white/5">
                      {b.services?.map((s, idx) => (
                        <span key={idx} className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1 rounded-lg">{s.name}</span>
                      ))}
                    </div>
                    <div className="mt-4 text-right">
                      <span className="text-xl font-black">{b.total}₽</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'services' && (
              <div className="space-y-6">
                <button onClick={() => setEditingItem({ id: Date.now(), name: '', price: 1000, duration: 30, icon: '✂️', description: '', photo: '/images/services/haircut.jpg' })} className="w-full p-8 border-2 border-dashed border-accent-gold/20 rounded-3xl flex items-center justify-center gap-4 text-accent-gold font-black uppercase tracking-widest bg-accent-gold/5 active:scale-95 transition-all">
                  <Plus /> Добавить услугу
                </button>
                {editingItem && adminTab === 'services' && (
                  <Modal title="Редактировать услугу" onClose={() => setEditingItem(null)}>
                    <div className="space-y-6">
                      <input className="admin-input" placeholder="Название" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-4">
                        <input className="admin-input" type="number" placeholder="Цена" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })} />
                        <input className="admin-input" type="number" placeholder="Минуты" value={editingItem.duration} onChange={e => setEditingItem({ ...editingItem, duration: Number(e.target.value) })} />
                      </div>
                      <input className="admin-input" placeholder="Иконка (emoji)" value={editingItem.icon} onChange={e => setEditingItem({ ...editingItem, icon: e.target.value })} />
                      <textarea className="admin-input h-24 pt-4" placeholder="Описание" value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} />
                      <button className="btn-luxury py-5" onClick={() => {
                        const existing = data.services.find(s => s.id === editingItem.id);
                        const newList = existing ? data.services.map(s => s.id === editingItem.id ? editingItem : s) : [...data.services, editingItem];
                        saveCollection('services', newList);
                      }}>
                        <Save size={20} className="mr-2 inline" /> Сохранить
                      </button>
                    </div>
                  </Modal>
                )}
                {data.services.map(s => (
                  <div key={s.id} className="glass-card flex items-center p-4 gap-5">
                    <img src={s.photo} className="w-16 h-16 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-lg mb-1">{s.name}</div>
                      <div className="text-[10px] text-secondary font-black tracking-widest uppercase">{s.price}₽ • {s.duration} мин</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingItem(s)} className="p-3 bg-white/5 rounded-xl border border-white/10"><Edit2 size={16} /></button>
                      <button onClick={() => deleteItem('services', s.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'masters' && (
              <div className="space-y-6">
                <button onClick={() => setEditingItem({ id: Date.now(), name: '', title: 'Master', rating: 5.0, photo: '/images/masters/m1.jpg' })} className="w-full p-8 border-2 border-dashed border-accent-gold/20 rounded-3xl flex items-center justify-center gap-4 text-accent-gold font-black uppercase tracking-widest bg-accent-gold/5 active:scale-95 transition-all">
                  <Plus /> Добавить мастера
                </button>
                {editingItem && adminTab === 'masters' && (
                  <Modal title="Редактировать мастера" onClose={() => setEditingItem(null)}>
                    <div className="space-y-6">
                      <input className="admin-input" placeholder="Имя" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                      <input className="admin-input" placeholder="Титул" value={editingItem.title} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} />
                      <input className="admin-input" type="number" step="0.1" placeholder="Рейтинг" value={editingItem.rating} onChange={e => setEditingItem({ ...editingItem, rating: Number(e.target.value) })} />
                      <input className="admin-input" placeholder="Фото URL" value={editingItem.photo} onChange={e => setEditingItem({ ...editingItem, photo: e.target.value })} />
                      <button className="btn-luxury py-5" onClick={() => {
                        const existing = data.masters.find(m => m.id === editingItem.id);
                        const newList = existing ? data.masters.map(m => m.id === editingItem.id ? editingItem : m) : [...data.masters, editingItem];
                        saveCollection('masters', newList);
                      }}>
                        <Save size={20} className="mr-2 inline" /> Сохранить
                      </button>
                    </div>
                  </Modal>
                )}
                {data.masters.map(m => (
                  <div key={m.id} className="glass-card flex items-center p-4 gap-5">
                    <img src={m.photo} className="w-16 h-16 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-lg mb-1">{m.name}</div>
                      <div className="text-[10px] text-accent-gold font-black tracking-widest uppercase">{m.title}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingItem(m)} className="p-3 bg-white/5 rounded-xl border border-white/10"><Edit2 size={16} /></button>
                      <button onClick={() => deleteItem('masters', m.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="glass-card p-10 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[3px] text-secondary opacity-60">Описание Барбершопа</label>
                  <input className="admin-input" value={data.settings.name} onChange={e => setData({ ...data, settings: { ...data.settings, name: e.target.value } })} />
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[3px] text-secondary opacity-60">Открытие</label>
                    <input className="admin-input" type="time" value={data.settings.working_hours.start} onChange={e => setData({ ...data, settings: { ...data.settings, working_hours: { ...data.settings.working_hours, start: e.target.value } } })} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[3px] text-secondary opacity-60">Закрытие</label>
                    <input className="admin-input" type="time" value={data.settings.working_hours.end} onChange={e => setData({ ...data, settings: { ...data.settings, working_hours: { ...data.settings.working_hours, end: e.target.value } } })} />
                  </div>
                </div>
                <button className="btn-luxury py-6 font-black tracking-[4px]" onClick={() => {
                  axios.post('/api/data', { action: 'update_settings', data: data.settings, pin: adminPin });
                  WebApp.showAlert('Сохранено');
                }}>ОБНОВИТЬ ОФИС</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .admin-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 2px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 20px;
          color: white;
          font-weight: 700;
          outline: none;
          transition: all 0.3s;
        }
        .admin-input:focus {
          border-color: var(--accent-gold);
          background: rgba(197, 166, 118, 0.05);
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
