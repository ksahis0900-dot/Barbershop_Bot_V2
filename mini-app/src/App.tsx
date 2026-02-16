import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  User,
  Sparkles,
  Award
} from 'lucide-react';

// --- Types ---
interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  icon: string;
  description: string;
}

interface Master {
  id: string;
  name: string;
  role: string;
  rating: number;
  photo: string;
}

// --- Mock Data ---
const SERVICES: Service[] = [
  { id: '1', name: 'Стрижка «Retro»', price: 1500, duration: '60 мин', icon: '✂️', description: 'Классическая мужская стрижка с укладкой' },
  { id: '2', name: 'Моделирование бороды', price: 800, duration: '40 мин', icon: '🧔', description: 'Четкие контуры и уход маслом' },
  { id: '3', name: 'Стрижка + Борода', price: 2100, duration: '90 мин', icon: '💎', description: 'Полный комплекс преображения' },
  { id: '4', name: 'Королевское бритьё', price: 1200, duration: '50 мин', icon: '🪒', description: 'Бритье опасной бритвой с распариванием' },
  { id: '5', name: 'Камуфляж седины', price: 1000, duration: '30 мин', icon: '🎨', description: 'Естественное тонирование волос' },
];

const MASTERS: Master[] = [
  { id: '1', name: 'Александр', role: 'Top Barber', rating: 5.0, photo: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop' },
  { id: '2', name: 'Дмитрий', role: 'Master Barber', rating: 4.9, photo: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=400&h=400&fit=crop' },
  { id: '3', name: 'Игорь', role: 'Barber', rating: 4.8, photo: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&h=400&fit=crop' },
];

type Step = 'services' | 'masters' | 'confirmation' | 'success';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('services');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    // Theme adaptation
    const theme = WebApp.themeParams;
    if (theme.bg_color) {
      document.documentElement.style.setProperty('--bg-color', theme.bg_color);
    }
  }, []);

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const handleBooking = () => {
    const bookingData = {
      services: selectedServices,
      master: selectedMaster,
      total: totalPrice,
      timestamp: new Date().toISOString()
    };
    WebApp.sendData(JSON.stringify(bookingData));
    setStep('success');
  };

  return (
    <div className="container p-4 max-w-lg mx-auto overflow-x-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="logo-container"
      >
        <h1 className="logo-text">Retro</h1>
        <div className="logo-subtitle">Barbershop</div>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'services' && (
          <motion.div
            key="services"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2 px-2 mb-6">
              <Sparkles className="text-accent-gold w-5 h-5" />
              <h2 className="text-xl font-bold tracking-tight">Выберите услуги</h2>
            </div>

            {SERVICES.map((service) => (
              <div
                key={service.id}
                onClick={() => toggleService(service)}
                className={`glass-card p-5 mb-4 relative cursor-pointer ${selectedServices.find(s => s.id === service.id) ? 'selected' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start">
                    <span className="service-emoji">{service.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{service.name}</h3>
                      <p className="text-secondary text-sm mb-3">{service.description}</p>
                      <div className="flex items-center space-x-3">
                        <span className="price-text">{service.price}₽</span>
                        <div className="flex items-center text-secondary text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {service.duration}
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedServices.find(s => s.id === service.id) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-accent-gold bg-accent-gold/20 p-1 rounded-full"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                    </motion.div>
                  )}
                </div>
              </div>
            ))}

            {selectedServices.length > 0 && (
              <div className="sticky-footer">
                <button
                  onClick={() => setStep('masters')}
                  className="btn-luxury flex justify-between items-center"
                >
                  <span>Далее • {totalPrice}₽</span>
                  <ChevronRight />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'masters' && (
          <motion.div
            key="masters"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              onClick={() => setStep('services')}
              className="text-xs text-secondary mt-2 mb-4 flex items-center"
            >
              ← Назад к услугам
            </button>
            <div className="flex items-center space-x-2 px-2 mb-6">
              <User className="text-accent-gold w-5 h-5" />
              <h2 className="text-xl font-bold tracking-tight">Выберите мастера</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {MASTERS.map((master) => (
                <div
                  key={master.id}
                  onClick={() => setSelectedMaster(master)}
                  className={`glass-card p-4 flex items-center space-x-4 cursor-pointer ${selectedMaster?.id === master.id ? 'selected' : ''}`}
                >
                  <img src={master.photo} alt={master.name} className="w-20 h-20 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold text-lg">{master.name}</h3>
                      <div className="flex items-center text-accent-gold text-sm font-bold">
                        ★ {master.rating}
                      </div>
                    </div>
                    <div className="flex items-center px-2 py-1 bg-white/5 rounded-lg w-fit mb-2">
                      <Award className="w-3 h-3 text-accent-gold mr-1" />
                      <span className="text-xs font-semibold">{master.role}</span>
                    </div>
                  </div>
                  {selectedMaster?.id === master.id && (
                    <div className="text-accent-gold">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedMaster && (
              <div className="sticky-footer">
                <button
                  onClick={() => setStep('confirmation')}
                  className="btn-luxury flex justify-between items-center"
                >
                  <span>Проверить детали</span>
                  <ChevronRight />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'confirmation' && (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-center mb-8">Итого</h2>

            <div className="glass-card p-6 border-accent-gold/30">
              <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-white/10">
                <img src={selectedMaster?.photo} className="w-16 h-16 rounded-xl object-cover" />
                <div>
                  <div className="text-xs text-secondary uppercase font-bold tracking-widest mb-1">Ваш мастер</div>
                  <div className="text-xl font-bold">{selectedMaster?.name}</div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="text-xs text-secondary uppercase font-bold tracking-widest mb-4">Выбранные услуги</div>
                {selectedServices.map(s => (
                  <div key={s.id} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="font-bold">{s.price}₽</span>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-lg font-bold">К оплате:</span>
                <span className="text-3xl font-extrabold text-accent-gold">{totalPrice}₽</span>
              </div>
            </div>

            <button
              onClick={handleBooking}
              className="btn-luxury py-5 text-lg"
            >
              Подтвердить запись
            </button>
            <button
              onClick={() => setStep('masters')}
              className="w-full text-secondary text-sm font-medium"
            >
              ← Изменить детали
            </button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 px-4"
          >
            <div className="flex justify-center mb-10">
              <div className="bg-accent-gold/10 p-8 rounded-full">
                <CheckCircle2 className="w-24 h-24 text-accent-gold" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-4">Готово!</h2>
            <p className="text-secondary mb-8 leading-relaxed">
              Данные переданы боту. Пожалуйста, вернитесь в чат и отправьте ваш контакт для окончательного подтверждения.
            </p>
            <button
              onClick={() => WebApp.close()}
              className="btn-luxury"
            >
              Вернуться в чат
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
