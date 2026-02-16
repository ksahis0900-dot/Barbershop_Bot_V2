import React, { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Clock,
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
  X,
  Smartphone,
  Info
} from 'lucide-react';
import {
  format,
  addDays,
  startOfDay,
  isSameDay,
  parse,
  addMinutes,
  isAfter,
  setHours,
  setMinutes
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
  // State
  const [step, setStep] = useState<Step>('services');
  const [data, setData] = useState<{ services: Service[], masters: Master[], settings: any, bookings: Booking[] }>({
    services: [],
    masters: [],
    settings: {},
    bookings: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Selection
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Admin State
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminTab, setAdminTab] = useState<'services' | 'masters' | 'bookings' | 'settings'>('bookings');

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
      setError('Ошибка загрузки данных. Попробуйте обновить.');
      setLoading(false);
    }
  };

  const authenticateAdmin = async () => {
    try {
      const res = await axios.post('/api/data', { action: 'admin_auth', pin: adminPin });
      if (res.data.success) {
        setIsAdminAuthenticated(true);
        setStep('admin');
      } else {
        WebApp.showAlert('Неверный ПИН-код');
      }
    } catch (err) {
      WebApp.showAlert('Ошибка авторизации');
    }
  };

  // --- Logic ---
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const availableTimes = useMemo(() => {
    if (!selectedMaster || !selectedDate) return [];

    const times = [];
    const workStart = parse(data.settings?.working_hours?.start || '10:00', 'HH:mm', new Date());
    const workEnd = parse(data.settings?.working_hours?.end || '21:00', 'HH:mm', new Date());

    let current = workStart;
    const dateStr = format(selectedDate, 'YYYY-MM-DD');

    while (isAfter(workEnd, current) || format(current, 'HH:mm') === format(workEnd, 'HH:mm')) {
      const timeStr = format(current, 'HH:mm');

      // Check if slot overlaps with any booking
      const isOccupied = data.bookings.some(b => {
        if (b.masterId != selectedMaster.id || b.date !== dateStr) return false;

        const bStart = parse(b.time, 'HH:mm', new Date());
        const bDuration = b.services.reduce((sum, s) => sum + s.duration, 0);
        const bEnd = addMinutes(bStart, bDuration);

        const slotStart = current;
        const slotEnd = addMinutes(current, totalDuration);

        // Overlap logic: (StartA < EndB) and (EndA > StartB)
        return (slotStart < bEnd && slotEnd > bStart);
      });

      if (!isOccupied) {
        times.push(timeStr);
      }

      current = addMinutes(current, 30); // 30 min step
    }
    return times;
  }, [selectedMaster, selectedDate, selectedServices, data.bookings]);

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
      date: format(selectedDate, 'YYYY-MM-DD'),
      time: selectedTime,
      total: totalPrice,
      duration: totalDuration
    };
    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  // --- Views ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0d10]">
        <div className="text-accent-gold text-xl font-bold animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container p-4 max-w-lg mx-auto overflow-x-hidden min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pt-4">
        <div className="logo-container p-0 m-0 text-left">
          <h1 className="logo-text text-2xl tracking-normal">{data.settings?.name || 'Retro'}</h1>
          <div className="logo-subtitle text-[8px] tracking-[4px]">Barbershop</div>
        </div>
        <button
          onClick={() => step === 'admin' ? setStep('services') : setStep('admin_auth')}
          className="p-2 text-secondary hover:text-accent-gold transition-colors"
        >
          {step === 'admin' ? <X size={20} /> : <Settings size={20} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="text-accent-gold" size={20} /> Выберите услуги
            </h2>
            <div className="space-y-4">
              {data.services.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleService(s)}
                  className={`glass-card p-0 transition-all active:scale-[0.98] ${selectedServices.find(x => x.id === s.id) ? 'selected ring-2 ring-accent-gold' : ''}`}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img src={s.photo} alt={s.name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold border border-white/10 uppercase tracking-widest">
                      {s.icon} {s.duration} мин
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold">{s.name}</h3>
                      <span className="price-text">{s.price}₽</span>
                    </div>
                    <p className="text-sm text-secondary line-clamp-2 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button onClick={() => setStep('masters')} className="btn-luxury flex justify-between items-center">
                  <span>Далее • {totalPrice}₽</span>
                  <ChevronRight />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div key="masters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <User className="text-accent-gold" size={20} /> Выберите мастера
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {data.masters.map(m => (
                <div key={m.id} onClick={() => setSelectedMaster(m)} className={`glass-card p-4 flex items-center gap-4 ${selectedMaster?.id === m.id ? 'selected ring-2 ring-accent-gold' : ''}`}>
                  <img src={m.photo} className="w-20 h-20 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{m.name}</h3>
                    <div className="text-secondary text-sm flex items-center gap-1 mb-2">
                      <Award size={14} className="text-accent-gold" /> {m.title}
                    </div>
                    <div className="flex items-center text-accent-gold font-bold text-sm">★ {m.rating}</div>
                  </div>
                  {selectedMaster?.id === m.id && <CheckCircle2 className="text-accent-gold" />}
                </div>
              ))}
            </div>
            {selectedMaster && (
              <div className="sticky-footer">
                <button onClick={() => setStep('calendar')} className="btn-luxury flex justify-between items-center">
                  <span>Выбрать время</span>
                  <ChevronRight />
                </button>
              </div>
            )}
            <button onClick={() => setStep('services')} className="mt-6 w-full text-secondary flex items-center justify-center gap-2">
              <ChevronLeft size={16} /> Назад
            </button>
          </motion.div>
        )}

        {step === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <CalendarIcon className="text-accent-gold" size={20} /> Дата и время
            </h2>

            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
              {[...Array(14)].map((_, i) => {
                const day = addDays(new Date(), i + 1);
                const active = isSameDay(day, selectedDate);
                return (
                  <div
                    key={i}
                    onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                    className={`flex-shrink-0 w-16 p-3 rounded-2xl border flex flex-col items-center transition-all ${active ? 'bg-accent-gold text-black border-accent-gold' : 'border-white/10 bg-white/5 text-secondary'}`}
                  >
                    <span className="text-[10px] uppercase font-bold mb-1">{format(day, 'EEE', { locale: ru })}</span>
                    <span className="text-lg font-extrabold">{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {availableTimes.length > 0 ? (
                availableTimes.map(t => (
                  <div
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={`p-3 rounded-xl text-center font-bold border transition-all ${selectedTime === t ? 'bg-accent-gold text-black border-accent-gold shadow-lg shadow-accent-gold/20' : 'border-white/10 bg-white/5 text-secondary'}`}
                  >
                    {t}
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-10 text-secondary">Нет свободных мест на эту дату :(</div>
              )}
            </div>

            {selectedTime && (
              <div className="sticky-footer">
                <button onClick={() => setStep('confirmation')} className="btn-luxury flex justify-between items-center">
                  <span>Подтвердить детали</span>
                  <ChevronRight />
                </button>
              </div>
            )}
            <button onClick={() => setStep('masters')} className="mt-6 w-full text-secondary flex items-center justify-center gap-2">
              <ChevronLeft size={16} /> Назад
            </button>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="glass-card overflow-visible">
              <div className="relative -mt-4 mx-4 p-6 rounded-3xl bg-accent-gold text-black shadow-xl">
                <div className="text-[10px] uppercase font-bold tracking-[2px] opacity-70 mb-1">Ваша запись</div>
                <div className="text-3xl font-extrabold">{selectedTime}</div>
                <div className="text-sm font-bold opacity-80 uppercase">{format(selectedDate, 'd MMMM, EEEE', { locale: ru })}</div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <img src={selectedMaster?.photo} className="w-12 h-12 rounded-xl object-cover" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">Мастер</div>
                    <div className="font-bold">{selectedMaster?.name}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">Услуги</div>
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between items-center">
                      <span className="text-sm">{s.name}</span>
                      <span className="font-bold">{s.price}₽</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                  <span className="text-lg font-bold">Итого</span>
                  <span className="text-2xl font-black text-accent-gold">{totalPrice}₽</span>
                </div>
              </div>
            </div>

            <button onClick={handleFinalBooking} className="btn-luxury py-5 text-lg shadow-xl shadow-accent-gold/30">
              Записаться
            </button>
            <button onClick={() => setStep('calendar')} className="w-full text-secondary text-sm font-medium">
              ← Изменить время
            </button>
          </motion.div>
        )}

        {step === 'success' && (
          <div className="text-center py-20">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-accent-gold/10 p-10 rounded-full w-fit mx-auto mb-10">
              <CheckCircle2 size={100} className="text-accent-gold" />
            </motion.div>
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Будем ждать!</h2>
            <p className="text-secondary mb-10 max-w-[80%] mx-auto leading-relaxed">Данные отправлены боту. Возвращайтесь в чат, мастер скоро свяжется с вами.</p>
            <button onClick={() => WebApp.close()} className="btn-luxury">Вернуться в чат</button>
          </div>
        )}

        {step === 'admin_auth' && (
          <motion.div key="admin_auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 px-4">
            <div className="bg-white/5 p-8 rounded-[32px] w-full border border-white/10">
              <h2 className="text-xl font-bold mb-6 text-center">Режим Директора</h2>
              <div className="space-y-4">
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Введите ПИН-код"
                  className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-center text-2xl tracking-[10px] focus:border-accent-gold outline-none"
                />
                <button onClick={authenticateAdmin} className="btn-luxury">Войти</button>
                <button onClick={() => setStep('services')} className="w-full text-secondary text-sm">Отмена</button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex gap-2 overflow-x-auto mb-6 no-scrollbar">
              {['bookings', 'services', 'masters', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${adminTab === tab ? 'bg-accent-gold text-black' : 'bg-white/5 text-secondary border border-white/10'}`}
                >
                  {tab === 'bookings' ? 'Записи' : tab === 'services' ? 'Услуги' : tab === 'masters' ? 'Мастера' : 'Настройка'}
                </button>
              ))}
            </div>

            {adminTab === 'bookings' && (
              <div className="space-y-4">
                {data.bookings.length === 0 ? (
                  <div className="text-center py-20 text-secondary border border-dashed border-white/10 rounded-2xl">Пока записей нет</div>
                ) : (
                  data.bookings.sort((a, b) => b.id - a.id).map(b => (
                    <div key={b.id} className="glass-card p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-accent-gold font-black text-xl">{b.time}</div>
                          <div className="text-xs text-secondary">{b.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">{b.clientName || 'Без имени'}</div>
                          <div className="text-[10px] text-secondary">{b.total}₽</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {b.services.map(s => <span key={s.id} className="text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/10">{s.name}</span>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === 'services' && (
              <div className="space-y-4">
                <button className="w-full p-4 border border-dashed border-accent-gold text-accent-gold rounded-2xl flex items-center justify-center gap-2 font-bold mb-4">
                  <Plus size={18} /> Добавить услугу
                </button>
                {data.services.map(s => (
                  <div key={s.id} className="glass-card flex items-center p-3 gap-4">
                    <img src={s.photo} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-sm">{s.name}</div>
                      <div className="text-[10px] text-secondary">{s.price}₽ • {s.duration} мин</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-secondary hover:text-white"><Settings size={16} /></button>
                      <button className="p-2 text-secondary hover:text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="glass-card p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-secondary tracking-widest">Название Барбершопа</label>
                  <input type="text" value={data.settings.name} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-secondary tracking-widest">Открытие</label>
                    <input type="time" value={data.settings.working_hours.start} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-secondary tracking-widest">Закрытие</label>
                    <input type="time" value={data.settings.working_hours.end} className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none" />
                  </div>
                </div>
                <button className="btn-luxury">Сохранить</button>
              </div>
            )}

            <div className="text-center mt-10 opacity-50 text-[10px] uppercase tracking-widest">v1.5.0 - Director Mode</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
