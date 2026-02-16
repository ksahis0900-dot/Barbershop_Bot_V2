import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import {
  Scissors,
  User,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Phone,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types from our existing database
interface Service {
  id: number;
  name: string;
  price: number;
  duration: number;
}

interface Master {
  id: number;
  name: string;
  title: string;
  rating: number;
}

const App: React.FC = () => {
  const [step, setStep] = useState<'services' | 'masters' | 'confirmation' | 'success'>('services');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);

  // Mock data (in production these will be fetched from API)
  const services: Service[] = [
    { id: 1, name: "Мужская стрижка", price: 2000, duration: 60 },
    { id: 2, name: "Стрижка бороды", price: 1200, duration: 30 },
    { id: 3, name: "Королевское бритье", price: 1800, duration: 45 },
    { id: 4, name: "Стрижка машинкой", price: 1000, duration: 30 },
    { id: 5, name: "Отец + Сын", price: 3500, duration: 90 },
    { id: 6, name: "Камуфляж седины", price: 1500, duration: 45 },
    { id: 10, name: "Комплекс (Стрижка + Борода)", price: 2800, duration: 75 },
  ];

  const masters: Master[] = [
    { id: 1, name: "Алекс", title: "Top Barber", rating: 4.9 },
    { id: 2, name: "Дмитрий", title: "Barber", rating: 4.7 },
    { id: 3, name: "Сергей", title: "Pro Barber", rating: 4.8 },
    { id: 5, name: "Максим", title: "Art Director", rating: 5.0 },
  ];

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    // Set theme colors
    const theme = WebApp.themeParams;
    document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color || '#0f172a');
    document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color || '#f8fafc');
  }, []);

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const handleBooking = () => {
    const bookingData = {
      services: selectedServices,
      master: selectedMaster,
      total: totalPrice
    };

    // Send data back to the bot
    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  return (
    <div className="flex-1 p-4 max-w-md mx-auto">
      {/* Header */}
      <header className="mb-8 mt-4 text-center">
        <h1 className="text-3xl font-bold gradient-text">RETRO</h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase">Barbershop</p>
      </header>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div
            key="services"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Scissors className="text-amber-400 w-5 h-5" />
              <h2 className="text-xl font-semibold">Выберите услуги</h2>
            </div>

            <div className="space-y-3">
              {services.map(service => (
                <div
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className={`glass-card p-4 flex justify-between items-center transition-all ${selectedServices.find(s => s.id === service.id)
                    ? 'ring-2 ring-amber-400 bg-amber-400/10'
                    : ''
                    }`}
                >
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-xs text-slate-400">{service.duration} мин</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-400">{service.price}₽</p>
                    {selectedServices.find(s => s.id === service.id) && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 mt-1 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed bottom-6 left-4 right-4"
              >
                <div className="glass-card bg-slate-800/90 p-4 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400">Итого: {totalPrice}₽</span>
                    <span className="text-slate-400">{totalDuration} мин</span>
                  </div>
                  <button
                    onClick={() => setStep('masters')}
                    className="btn-primary flex justify-center items-center gap-2"
                  >
                    Далее <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div
            key="masters"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setStep('services')}
              className="text-slate-400 text-sm mb-4 flex items-center gap-1"
            >
              ← Назад к услугам
            </button>
            <div className="flex items-center gap-2 mb-4">
              <User className="text-amber-400 w-5 h-5" />
              <h2 className="text-xl font-semibold">Выберите мастера</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {masters.map(master => (
                <div
                  key={master.id}
                  onClick={() => {
                    setSelectedMaster(master);
                    setStep('confirmation');
                  }}
                  className="glass-card p-4 flex items-center gap-4 hover:bg-slate-700/50 transition-colors cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center border-2 border-amber-400/30">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{master.name}</h3>
                    <p className="text-sm text-slate-400">{master.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">{master.rating}</span>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-500" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <button
              onClick={() => setStep('masters')}
              className="text-slate-400 text-sm mb-4 flex items-center gap-1"
            >
              ← Изменить мастера
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center">Проверьте детали</h2>

            <div className="glass-card p-6 space-y-6">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Услуги</p>
                <div className="space-y-2">
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span>{s.name}</span>
                      <span className="font-semibold">{s.price}₽</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700 mt-4 pt-2 flex justify-between font-bold">
                  <span>Итого</span>
                  <span className="text-amber-400">{totalPrice}₽</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Мастер</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedMaster?.name}</p>
                    <p className="text-xs text-slate-500">{selectedMaster?.title}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="text-xs">Центральная, 123</span>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span className="text-xs">+7 999 123-45-67</span>
                </div>
              </div>

              <button
                onClick={handleBooking}
                className="btn-primary py-4 text-lg shadow-xl shadow-amber-400/10"
              >
                ЗАБРОНИРОВАТЬ
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Заявка отправлена!</h2>
            <p className="text-slate-400 mb-8">Мастер свяжется с вами в ближайшее время для подтверждения.</p>
            <button
              onClick={() => WebApp.close()}
              className="bg-slate-800 text-white px-8 py-3 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Закрыть
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
