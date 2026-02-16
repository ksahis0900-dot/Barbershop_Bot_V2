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
  X,
  Clock,
  MapPin
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
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Admin State
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState<'bookings' | 'services' | 'masters' | 'settings'>('bookings');

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
        const bDuration = b.services?.reduce((sum, s) => sum + s.duration, 0) || 60;
        const bEnd = addMinutes(bStart, bDuration);

        const slotStart = current;
        const slotEnd = addMinutes(current, totalDuration);

        return (slotStart < bEnd && slotEnd > bStart);
      });

      if (!isOccupied) {
        times.push(timeStr);
      }

      current = addMinutes(current, 30);
    }
    return times;
  }, [selectedMaster, selectedDate, selectedServices, totalDuration, data.bookings, data.settings]);

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

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
      // Direct POST to API to ensure it hits the "Admin Panel" database
      await axios.post('/api/data', {
        action: 'add_booking',
        data: bookingData
      });
    } catch (err) {
      console.error('API update failed:', err);
    }

    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  // --- Views ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0c0d10]">
        <div className="logo-container mb-4">
          <h1 className="logo-text text-3xl">RETRO</h1>
          <div className="logo-subtitle">Barbershop</div>
        </div>
        <div className="text-accent-gold text-sm font-bold animate-pulse tracking-widest">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="container p-0 max-w-lg mx-auto overflow-x-hidden min-h-screen">
      {/* Top Header */}
      <div className="px-6 pt-6 flex justify-between items-center">
        <div className="logo-container p-0 m-0 text-left">
          <h1 className="logo-text text-2xl tracking-[2px]">{data.settings?.name?.split(' ')[0] || 'RETRO'}</h1>
          <div className="logo-subtitle text-[8px] tracking-[4px]">{data.settings?.name?.split(' ')[1] || 'BARBERSHOP'}</div>
        </div>
        <button
          onClick={() => step === 'admin' ? setStep('services') : setStep('admin_auth')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-secondary active:scale-95 transition-all"
        >
          {step === 'admin' ? <X size={20} /> : <Settings size={20} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 pb-32">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Выберите услуги</h2>
              <div className="text-[10px] items-center gap-1 flex text-secondary uppercase tracking-widest">
                <Clock size={12} /> {totalDuration} мин
              </div>
            </div>

            <div className="space-y-6">
              {data.services.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleService(s)}
                  className={`glass-card p-0 transition-all ${selectedServices.find(x => x.id === s.id) ? 'selected scale-[1.02]' : ''}`}
                >
                  <div className="relative h-44 overflow-hidden">
                    <img src={s.photo} alt={s.name} className="w-full h-full object-cover grayscale-[0.2]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-accent-gold tracking-widest mb-1">{s.icon} Service</div>
                        <h3 className="text-xl font-bold">{s.name}</h3>
                      </div>
                      <div className="price-text">{s.price}₽</div>
                    </div>
                  </div>
                  {selectedServices.find(x => x.id === s.id) && (
                    <div className="absolute top-4 right-4 bg-accent-gold text-black rounded-full p-1">
                      <CheckCircle2 size={24} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button onClick={() => setStep('masters')} className="btn-luxury flex justify-between items-center group">
                  <span>Мастера</span>
                  <div className="flex items-center gap-3">
                    <span className="opacity-60 text-xs font-medium">{totalPrice}₽</span>
                    <ChevronRight className="group-active:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div key="masters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 pb-32">
            <h2 className="text-2xl font-bold mb-8">Мастер</h2>
            <div className="grid grid-cols-1 gap-6">
              {data.masters.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMaster(m)}
                  className={`glass-card p-5 flex items-center gap-6 transition-all ${selectedMaster?.id === m.id ? 'selected scale-[1.02]' : ''}`}
                >
                  <div className="relative">
                    <img src={m.photo} className="w-24 h-24 rounded-2xl object-cover ring-1 ring-white/10" />
                    {selectedMaster?.id === m.id && (
                      <div className="absolute -bottom-2 -right-2 bg-accent-gold text-black rounded-full p-1 scale-75">
                        <CheckCircle2 size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">{m.name}</h3>
                    <div className="text-secondary text-xs flex items-center gap-2 mb-3">
                      <Award size={14} className="text-accent-gold" /> {m.title}
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full w-fit">
                      <span className="text-accent-gold text-xs font-bold leading-none">★ {m.rating}</span>
                    </div>
                  </div>
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
            <button onClick={() => setStep('services')} className="mt-8 w-full text-secondary text-sm font-medium flex items-center justify-center gap-2">
              <ChevronLeft size={16} /> К услугам
            </button>
          </motion.div>
        )}

        {step === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6 pb-32">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Дата и время</h2>
              <div className="text-xs text-secondary flex items-center gap-2">
                <MapPin size={12} /> {data.settings?.address}
              </div>
            </div>

            <div className="date-scroller scrollbar-hide">
              {[...Array(30)].map((_, i) => {
                const day = addDays(new Date(), i + 1);
                const active = isSameDay(day, selectedDate);
                return (
                  <div
                    key={i}
                    onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                    className={`date-item ${active ? 'active' : ''}`}
                  >
                    <span className={`text-[10px] uppercase font-bold mb-1 ${active ? 'text-black/60' : 'text-secondary opacity-60'}`}>
                      {format(day, 'EEE', { locale: ru })}
                    </span>
                    <span className="text-xl font-bold tracking-tight">{format(day, 'd')}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <div className="text-[10px] uppercase font-bold text-secondary tracking-[2px] mb-4">Доступные слоты</div>
              <div className="time-grid">
                {availableTimes.length > 0 ? (
                  availableTimes.map(t => (
                    <div
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`time-slot ${selectedTime === t ? 'selected' : ''}`}
                    >
                      {t}
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-10 text-secondary bg-white/5 rounded-2xl border border-dashed border-white/10">
                    На этот день нет свободного времени
                  </div>
                )}
              </div>
            </div>

            {selectedTime && (
              <div className="sticky-footer">
                <button onClick={() => setStep('confirmation')} className="btn-luxury flex justify-between items-center">
                  <span>Далее</span>
                  <ChevronRight />
                </button>
              </div>
            )}
            <button onClick={() => setStep('masters')} className="mt-8 w-full text-secondary text-sm font-medium flex items-center justify-center gap-2">
              <ChevronLeft size={16} /> Назад
            </button>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6">
            <div className="glass-card mb-8 overflow-visible">
              <div className="relative -mt-6 mx-6 p-8 rounded-[32px] bg-accent-gold text-[#0c0d10] shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-3xl rounded-full translate-x-10 -translate-y-10" />
                <div className="text-[10px] uppercase font-black tracking-[3px] opacity-60 mb-2">Ваша запись</div>
                <div className="text-4xl font-extrabold mb-1">{selectedTime}</div>
                <div className="text-xs font-bold uppercase tracking-wide opacity-80">{format(selectedDate, 'd MMMM, EEEE', { locale: ru })}</div>
              </div>

              <div className="p-8 space-y-8">
                <div className="flex items-center gap-5">
                  <img src={selectedMaster?.photo} className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/5" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-secondary tracking-widest mb-1">Мастер</div>
                    <div className="font-bold text-lg">{selectedMaster?.name}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">Выбранные услуги</div>
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-bold text-accent-gold">{s.price}₽</span>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-white/10 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">Общая сумма</div>
                    <span className="text-3xl font-black text-white">{totalPrice}₽</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">Длительность</div>
                    <span className="font-bold text-lg">{totalDuration} мин</span>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleFinalBooking} className="btn-luxury py-6 text-base tracking-[3px]">
              Подтвердить запись
            </button>
            <button onClick={() => setStep('calendar')} className="mt-6 w-full text-secondary text-sm font-bold uppercase tracking-[1px] opacity-40">
              ← Назад
            </button>
          </motion.div>
        )}

        {step === 'success' && (
          <div className="p-6 text-center py-20">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: 'spring', damping: 10 }} className="bg-accent-gold/10 p-12 rounded-full w-fit mx-auto mb-12 border border-accent-gold/20">
              <CheckCircle2 size={80} className="text-accent-gold" />
            </motion.div>
            <h2 className="text-4xl font-black mb-6 uppercase tracking-tighter">Готово!</h2>
            <p className="text-secondary mb-12 text-sm max-w-[80%] mx-auto leading-loose font-medium">Ваша запись создана. Мастер подтвердит её в ближайшее время в чате.</p>
            <button onClick={() => WebApp.close()} className="btn-luxury">Вернуться в бот</button>
          </div>
        )}

        {step === 'admin_auth' && (
          <motion.div key="admin_auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 pt-20">
            <div className="glass-card p-10">
              <div className="w-16 h-16 bg-accent-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-accent-gold/10">
                <Settings className="text-accent-gold" size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-center">Вход для персонала</h2>
              <p className="text-secondary text-[10px] text-center uppercase tracking-widest mb-10 font-bold opacity-60">Введите секретный код</p>
              <div className="space-y-6">
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-6 rounded-2xl text-center text-4xl tracking-[12px] font-black focus:border-accent-gold outline-none transition-all shadow-inner"
                />
                <button onClick={authenticateAdmin} className="btn-luxury">Открыть панель</button>
                <button onClick={() => setStep('services')} className="w-full text-secondary text-xs font-bold uppercase tracking-widest opacity-40">Отмена</button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
            <div className="flex gap-2 overflow-x-auto mb-10 scrollbar-hide">
              {['bookings', 'services', 'masters', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab as any)}
                  className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${adminTab === tab ? 'bg-accent-gold text-black border-accent-gold' : 'bg-white/5 text-secondary border-white/10'}`}
                >
                  {tab === 'bookings' ? 'Записи' : tab === 'services' ? 'Каталог' : tab === 'masters' ? 'Мастера' : 'Офис'}
                </button>
              ))}
            </div>

            {adminTab === 'bookings' && (
              <div className="space-y-6">
                {data.bookings.length === 0 ? (
                  <div className="text-center py-24 text-secondary border-2 border-dashed border-white/5 rounded-[32px] font-bold text-xs uppercase tracking-widest opacity-40">Записей нет</div>
                ) : (
                  [...data.bookings].sort((a, b) => b.id - a.id).map(b => (
                    <div key={b.id} className="glass-card p-6 border-l-4 border-l-accent-gold">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="text-accent-gold font-black text-2xl">{b.time}</div>
                          <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{b.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base mb-1">{b.clientName || 'Клиент'}</div>
                          <div className="text-xs bg-white/5 px-3 py-1 rounded-full border border-white/10">{b.total}₽</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {b.services?.map((s, idx) => (
                          <span key={idx} className="text-[9px] font-black uppercase tracking-widest bg-accent-gold/10 text-accent-gold px-3 py-1 rounded-lg border border-accent-gold/20">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === 'services' && (
              <div className="space-y-6">
                <button className="w-full p-6 border-2 border-dashed border-accent-gold/30 text-accent-gold rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:bg-accent-gold/5 transition-all">
                  <Plus size={20} /> Добавить услугу
                </button>
                {data.services.map(s => (
                  <div key={s.id} className="glass-card flex items-center p-4 gap-5">
                    <img src={s.photo} className="w-14 h-14 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-base mb-1">{s.name}</div>
                      <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{s.price}₽ • {s.duration} мин</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-secondary"><Settings size={16} /></button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-secondary hover:text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'masters' && (
              <div className="space-y-6">
                {data.masters.map(m => (
                  <div key={m.id} className="glass-card flex items-center p-4 gap-5">
                    <img src={m.photo} className="w-14 h-14 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <div className="font-bold text-base mb-1">{m.name}</div>
                      <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{m.title}</div>
                    </div>
                    <div className="flex gap-2">
                      <Award size={18} className="text-accent-gold" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="glass-card p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-black text-secondary tracking-widest opacity-60">Название Барбершопа</label>
                  <input type="text" defaultValue={data.settings.name} className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none font-bold focus:border-accent-gold" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black text-secondary tracking-widest opacity-60">Открытие</label>
                    <input type="time" defaultValue={data.settings.working_hours.start} className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none font-bold focus:border-accent-gold" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-black text-secondary tracking-widest opacity-60">Закрытие</label>
                    <input type="time" defaultValue={data.settings.working_hours.end} className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none font-bold focus:border-accent-gold" />
                  </div>
                </div>
                <button className="btn-luxury py-5 font-black">Сохранить изменения</button>
              </div>
            )}

            <div className="text-center mt-12 opacity-30 text-[9px] font-black uppercase tracking-[4px]">v1.6.0 - Luxury Admin</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
