import React, { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronRight,
  User,
  Sparkles,
  Award,
  Calendar as CalendarIcon,
  Settings,
  Plus,
  Trash2,
  ChevronLeft,
  X
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
  duration: number; // minutes
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
}

type Step = 'services' | 'masters' | 'calendar' | 'confirmation' | 'success' | 'admin_auth' | 'admin';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('services');
  const [data, setData] = useState<{ services: Service[], masters: Master[], settings: any, bookings: Booking[] }>({
    services: [],
    masters: [],
    settings: {},
    bookings: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState<'bookings' | 'services' | 'masters' | 'settings'>('bookings');

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
      }
    } catch (err) {
      WebApp.showAlert('Ошибка авторизации');
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const availableTimes = useMemo(() => {
    if (!selectedMaster || !selectedDate) return [];

    const times = [];
    const workStart = parse(data.settings?.working_hours?.start || '10:00', 'HH:mm', new Date());
    const workEnd = parse(data.settings?.working_hours?.end || '21:00', 'HH:mm', new Date());

    let current = workStart;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    while (isAfter(workEnd, current)) {
      const timeStr = format(current, 'HH:mm');
      const isOccupied = data.bookings.some(b => {
        if (b.masterId != selectedMaster.id || b.date !== dateStr) return false;
        const bStart = parse(b.time, 'HH:mm', new Date());
        const bDuration = b.services.reduce((sum, s) => sum + s.duration, 0);
        const bEnd = addMinutes(bStart, bDuration);
        const slotStart = current;
        const slotEnd = addMinutes(current, totalDuration);
        return (slotStart < bEnd && slotEnd > bStart);
      });

      if (!isOccupied) times.push(timeStr);
      current = addMinutes(current, 30);
    }
    return times;
  }, [selectedMaster, selectedDate, selectedServices, data.bookings, data.settings]);

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleFinalBooking = () => {
    const bookingData = {
      services: selectedServices,
      master: selectedMaster,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: selectedTime,
      total: totalPrice,
      duration: totalDuration
    };
    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0c0d10]">
      <div className="text-accent-gold text-xl font-bold animate-pulse">Загрузка...</div>
    </div>
  );

  return (
    <div className="container p-4 max-w-lg mx-auto overflow-x-hidden min-h-screen">
      <div className="flex justify-between items-center mb-6 pt-4">
        <div className="logo-container p-0 m-0 text-left">
          <h1 className="logo-text text-2xl tracking-normal">{data.settings?.name || 'Retro'}</h1>
          <div className="logo-subtitle text-[8px] tracking-[4px]">Barbershop</div>
        </div>
        <button onClick={() => step === 'admin' ? setStep('services') : setStep('admin_auth')} className="p-2 text-secondary">
          {step === 'admin' ? <X size={20} /> : <Settings size={20} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Sparkles className="text-accent-gold" size={20} /> Выберите услуги</h2>
            <div className="space-y-4">
              {data.services.map(s => (
                <div key={s.id} onClick={() => toggleService(s)} className={`glass-card p-0 ${selectedServices.find(x => x.id === s.id) ? 'selected ring-2 ring-accent-gold' : ''}`}>
                  <div className="relative h-40 overflow-hidden">
                    <img src={s.photo} alt={s.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold border border-white/10 uppercase tracking-widest">{s.icon} {s.duration} мин</div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold">{s.name}</h3>
                      <span className="price-text">{s.price}₽</span>
                    </div>
                    <p className="text-sm text-secondary line-clamp-2">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button onClick={() => setStep('masters')} className="btn-luxury flex justify-between items-center">
                  <span>Далее • {totalPrice}₽</span> <ChevronRight />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div key="masters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User className="text-accent-gold" size={20} /> Выберите мастера</h2>
            <div className="grid grid-cols-1 gap-4">
              {data.masters.map(m => (
                <div key={m.id} onClick={() => setSelectedMaster(m)} className={`glass-card p-4 flex items-center gap-4 ${selectedMaster?.id === m.id ? 'selected ring-2 ring-accent-gold' : ''}`}>
                  <img src={m.photo} className="w-20 h-20 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{m.name}</h3>
                    <div className="text-secondary text-sm mb-2">{m.title}</div>
                    <div className="text-accent-gold font-bold text-sm">★ {m.rating}</div>
                  </div>
                  {selectedMaster?.id === m.id && <CheckCircle2 className="text-accent-gold" />}
                </div>
              ))}
            </div>
            {selectedMaster && (
              <div className="sticky-footer">
                <button onClick={() => setStep('calendar')} className="btn-luxury flex justify-between items-center">
                  <span>Выбрать время</span> <ChevronRight />
                </button>
              </div>
            )}
            <button onClick={() => setStep('services')} className="mt-6 w-full text-secondary flex items-center justify-center gap-2"><ChevronLeft size={16} /> Назад</button>
          </motion.div>
        )}

        {step === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CalendarIcon className="text-accent-gold" size={20} /> Дата и время</h2>
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
              {[...Array(14)].map((_, i) => {
                const day = addDays(new Date(), i + 1);
                const active = isSameDay(day, selectedDate);
                return (
                  <div key={i} onClick={() => { setSelectedDate(day); setSelectedTime(null); }} className={`flex-shrink-0 w-16 p-3 rounded-2xl border flex flex-col items-center transition-all ${active ? 'bg-accent-gold text-black border-accent-gold' : 'border-white/10 bg-white/5 text-secondary'}`}>
                    <span className="text-[10px] uppercase font-bold mb-1">{format(day, 'EEE', { locale: ru })}</span>
                    <span className="text-lg font-extrabold">{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {availableTimes.length > 0 ? availableTimes.map(t => (
                <div key={t} onClick={() => setSelectedTime(t)} className={`p-3 rounded-xl text-center font-bold border ${selectedTime === t ? 'bg-accent-gold text-black border-accent-gold' : 'border-white/10 bg-white/5 text-secondary'}`}>{t}</div>
              )) : <div className="col-span-3 text-center py-10 text-secondary">Нет мест</div>}
            </div>
            {selectedTime && (
              <div className="sticky-footer">
                <button onClick={() => setStep('confirmation')} className="btn-luxury flex justify-between items-center">
                  <span>Подтвердить</span> <ChevronRight />
                </button>
              </div>
            )}
            <button onClick={() => setStep('masters')} className="mt-6 w-full text-secondary flex items-center justify-center gap-2"><ChevronLeft size={16} /> Назад</button>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass-card mb-6">
              <div className="p-6 bg-accent-gold text-black">
                <div className="text-3xl font-black">{selectedTime}</div>
                <div className="font-bold">{format(selectedDate, 'd MMMM', { locale: ru })}</div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <img src={selectedMaster?.photo} className="w-12 h-12 rounded-xl object-cover" />
                  <div className="font-bold">{selectedMaster?.name}</div>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="font-bold">Итого</span>
                  <span className="text-2xl font-black text-accent-gold">{totalPrice}₽</span>
                </div>
              </div>
            </div>
            <button onClick={handleFinalBooking} className="btn-luxury py-5 text-lg">Записаться</button>
            <button onClick={() => setStep('calendar')} className="w-full text-secondary text-sm py-4">← Изменить время</button>
          </motion.div>
        )}

        {step === 'success' && (
          <div className="text-center py-20">
            <div className="bg-accent-gold/10 p-10 rounded-full w-fit mx-auto mb-10"><CheckCircle2 size={100} className="text-accent-gold" /></div>
            <h2 className="text-3xl font-black mb-4">ГОТОВО!</h2>
            <button onClick={() => WebApp.close()} className="btn-luxury">Вернуться в чат</button>
          </div>
        )}

        {step === 'admin_auth' && (
          <div className="py-20 px-4">
            <h2 className="text-xl font-bold mb-6 text-center">Вход для Директора</h2>
            <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="ПИН" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-2xl outline-none mb-4" />
            <button onClick={authenticateAdmin} className="btn-luxury">Войти</button>
          </div>
        )}

        {step === 'admin' && (
          <div>
            <div className="flex gap-2 overflow-x-auto mb-6 no-scrollbar">
              {['bookings', 'settings'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab as any)} className={`px-4 py-2 rounded-xl text-xs font-bold ${adminTab === tab ? 'bg-accent-gold text-black' : 'bg-white/5'}`}>{tab}</button>
              ))}
            </div>
            {adminTab === 'bookings' && (
              <div className="space-y-4">
                {data.bookings.map(b => (
                  <div key={b.id} className="glass-card p-4">
                    <div className="flex justify-between items-start">
                      <div><div className="text-accent-gold font-bold">{b.time}</div><div>{b.date}</div></div>
                      <div className="text-right"><div>{b.clientName}</div><div className="text-xs">{b.total}₽</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
