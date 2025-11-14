import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Calendar, Clock, MapPin, Star, X, Search, Menu } from 'lucide-react';

// --- CONSTANTS AND HELPERS ---

const API_BASE_URL = 'https://meddata-backend.onrender.com';

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      console.warn(`Request failed. Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const getBookings = () => {
  try {
    const stored = localStorage.getItem('bookings');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error retrieving bookings:", error);
    return [];
  }
};

const saveBookings = (bookings) => {
  try {
    localStorage.setItem('bookings', JSON.stringify(bookings));
  } catch (error) {
    console.error("Error saving bookings:", error);
  }
};

// --- CUSTOM COMPONENTS ---

const Dropdown = ({ id, label, value, options = [], onSelect, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredOptions = useMemo(() => 
    options.filter(option => {
      if (typeof option === 'string') {
        return option.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    }), [options, searchTerm]
  );
  
  useEffect(() => {
    setSearchTerm('');
  }, [options]);

  const handleSelect = (option) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div id={id} className="relative w-full">
      <label className="text-gray-700 text-sm font-semibold mb-2 block">{label}</label>
      <div 
        className="flex items-center justify-between p-3 border-2 border-gray-300 rounded-lg bg-white hover:border-blue-500 cursor-pointer transition-all" 
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value || `Select ${label}`}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <input
              type="text"
              placeholder={`Search ${label}...`}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No options found</div>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li
                  key={option}
                  className="p-3 text-sm hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleSelect(option); }}
                >
                  {option}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const HospitalCard = ({ hospital, onBookAppointment }) => {
  const rating = parseFloat(String(hospital['Hospital overall rating'])) || 0;
  
  const stars = useMemo(() => {
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  }, [rating]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
          <div className="text-4xl">🏥</div>
        </div>
        
        <div className="flex-grow">
          <h3 className="text-xl font-bold text-gray-800 mb-1 capitalize">
            {hospital['Hospital Name'].toLowerCase()}
          </h3>
          <p className="text-sm text-gray-600 mb-2 flex items-center">
            <MapPin className="w-4 h-4 mr-1 text-blue-500" />
            {hospital.City}, {hospital.State}
          </p>
          
          <div className="flex items-center mb-3">
            <span className="flex mr-2">{stars}</span>
            <span className="text-sm font-semibold text-gray-700">{rating.toFixed(1)}</span>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{hospital['Hospital Type']}</span>
          </div>

          <button 
            onClick={() => onBookAppointment(hospital)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            Book FREE Center Visit
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingModal = ({ hospital, onClose, onBook }) => {
  const dates = useMemo(() => {
    const today = new Date();
    return Array(7).fill(0).map((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return date;
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  const timeSlots = {
    Morning: ['09:00 AM', '10:00 AM', '11:00 AM'],
    Afternoon: ['01:00 PM', '02:00 PM', '03:00 PM'],
    Evening: ['05:00 PM', '06:00 PM', '07:00 PM'],
  };

  const handleBook = () => {
    if (selectedDate && selectedTimeSlot) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      onBook({
        ...hospital,
        bookingDate: formattedDate,
        bookingTime: selectedTimeSlot,
      });
      onClose();
    }
  };

  const isToday = (date) => date.toDateString() === new Date().toDateString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Book Appointment</h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          <h3 className="text-xl font-bold mb-2 capitalize text-blue-700">
            {hospital['Hospital Name'].toLowerCase()}
          </h3>
          <p className="text-sm text-gray-600 mb-6 flex items-center">
            <MapPin className="w-4 h-4 mr-1 text-blue-500" />
            {hospital.City}, {hospital.State}
          </p>

          <div className="mb-6">
            <h4 className="font-bold text-lg text-gray-800 mb-3">Select Date</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {dates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 p-3 rounded-xl border-2 text-center transition-all min-w-[80px] ${
                    selectedDate.toDateString() === date.toDateString() 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  <p className="text-xs font-medium mb-1">{isToday(date) ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-2xl font-bold">{date.getDate()}</p>
                  <p className="text-xs">{date.toLocaleDateString('en-US', { month: 'short' })}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg text-gray-800 mb-3">Select Time Slot</h4>
            <div className="space-y-4">
              {Object.entries(timeSlots).map(([period, slots]) => (
                <div key={period} className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-bold text-blue-700 mb-3">{period}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`px-4 py-2 text-sm rounded-lg border-2 transition-all ${
                          selectedTimeSlot === slot 
                            ? 'bg-green-600 border-green-600 text-white font-semibold shadow-md' 
                            : 'bg-white border-gray-300 text-gray-700 hover:border-green-300'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={!selectedDate || !selectedTimeSlot}
            className={`px-8 py-3 rounded-lg font-bold transition-all ${
              selectedDate && selectedTimeSlot 
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PAGES ---

const HomePage = ({
  states, 
  cities, 
  selectedState, 
  setSelectedState, 
  selectedCity, 
  setSelectedCity, 
  handleSearch, 
  searchResults,
  isLoading,
  openBookingModal
}) => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 py-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Skip the travel! Find Online
          </h1>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-6">
            Medical <span className="text-blue-600">Centers</span>
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Connect instantly with a 24x7 specialist or choose to video visit a particular doctor.
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl">
            Find Centers
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="container mx-auto px-4 -mt-8 relative z-10 max-w-5xl">
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <Dropdown
              id="state"
              label="State"
              value={selectedState}
              options={states}
              onSelect={setSelectedState}
              isLoading={isLoading.states}
            />
            <Dropdown
              id="city"
              label="City"
              value={selectedCity}
              options={cities}
              onSelect={setSelectedCity}
              isLoading={isLoading.cities}
            />
            <button 
              id="searchBtn"
              onClick={handleSearch}
              disabled={!selectedState || !selectedCity || isLoading.hospitals}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading.hospitals ? (
                'Searching...'
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </button>
          </div>

          {/* Quick Access */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600 mb-4">You may be looking for</p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { name: 'Doctors', icon: '👨‍⚕️' },
                { name: 'Labs', icon: '🔬' },
                { name: 'Hospitals', icon: '🏥', active: true },
                { name: 'Medical Store', icon: '💊' },
                { name: 'Ambulance', icon: '🚑' }
              ].map(item => (
                <div 
                  key={item.name} 
                  className={`p-3 rounded-xl transition-all cursor-pointer text-center min-w-[100px] ${
                    item.active 
                      ? 'bg-blue-100 border-2 border-blue-500 shadow-md' 
                      : 'bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-1">{item.icon}</div>
                  <span className="text-xs font-semibold text-gray-700">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {searchResults.length > 0 && (
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            <span className="text-blue-600">{searchResults.length}</span> medical centers available in{' '}
            <span className="capitalize">{selectedCity.toLowerCase()}</span>
          </h1>
        )}
        
        <div className="space-y-6">
          {searchResults.map((hospital, index) => (
            <HospitalCard 
              key={index} 
              hospital={hospital} 
              onBookAppointment={openBookingModal} 
            />
          ))}
        </div>

        {searchResults.length === 0 && selectedCity && selectedState && !isLoading.hospitals && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-xl text-gray-600 font-semibold mb-2">
              No medical centers found
            </p>
            <p className="text-gray-500">
              Try selecting a different city or state
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const MyBookingsPage = ({ bookings, onCancelBooking }) => {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-8 flex items-center gap-3">
        <Calendar className="w-10 h-10 text-blue-600" />
        My Bookings
      </h1>
      
      {bookings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-xl text-gray-600 font-semibold mb-2">
            No bookings yet
          </p>
          <p className="text-gray-500 mb-6">
            Book your first appointment to see it here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-all">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <div className="text-3xl">🏥</div>
                </div>
                
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2 capitalize">
                    {booking['Hospital Name'].toLowerCase()}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-blue-500" />
                    {booking.City}, {booking.State}
                  </p>
                  
                  <div className="flex flex-wrap gap-4 mb-3">
                    <div className="flex items-center text-green-700 bg-green-50 px-3 py-1 rounded-lg">
                      <Calendar className="w-5 h-5 mr-2" />
                      <span className="font-semibold">
                        {new Date(booking.bookingDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center text-green-700 bg-green-50 px-3 py-1 rounded-lg">
                      <Clock className="w-5 h-5 mr-2" />
                      <span className="font-semibold">{booking.bookingTime}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {booking['Hospital Type']}
                    </span>
                  </div>

                  <button
                    onClick={() => onCancelBooking(index)}
                    className="text-red-600 hover:text-red-700 text-sm font-semibold hover:underline"
                  >
                    Cancel Booking
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---

const App = () => {
  const [route, setRoute] = useState(
    window.location.pathname === '/my-bookings' ? 'MyBookings' : 'Home'
  );
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [bookings, setBookings] = useState(getBookings);
  const [bookingHospital, setBookingHospital] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isLoading, setIsLoading] = useState({
    states: false,
    cities: false,
    hospitals: false,
  });

  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname === '/my-bookings' ? 'MyBookings' : 'Home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(prev => ({ ...prev, states: true }));
      try {
        const data = await fetchWithRetry(`${API_BASE_URL}/states`);
        setStates(data.map(item => item.state).sort());
      } catch (e) {
        console.error("Failed to fetch states:", e);
      } finally {
        setIsLoading(prev => ({ ...prev, states: false }));
      }
    };
    fetchStates();
  }, []);

  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      setSelectedCity(null);
      setSearchResults([]);
      return;
    }

    const fetchCities = async () => {
      setIsLoading(prev => ({ ...prev, cities: true }));
      setCities([]);
      setSelectedCity(null);
      setSearchResults([]);
      try {
        const url = `${API_BASE_URL}/cities/${encodeURIComponent(selectedState)}`;
        const data = await fetchWithRetry(url);
        setCities(data.sort());
      } catch (e) {
        console.error("Failed to fetch cities:", e);
      } finally {
        setIsLoading(prev => ({ ...prev, cities: false }));
      }
    };

    fetchCities();
  }, [selectedState]);

  const handleSearch = useCallback(async () => {
    if (!selectedState || !selectedCity) return;

    setIsLoading(prev => ({ ...prev, hospitals: true }));
    setSearchResults([]);
    try {
      const url = `${API_BASE_URL}/data?state=${encodeURIComponent(selectedState)}&city=${encodeURIComponent(selectedCity)}`;
      const data = await fetchWithRetry(url);
      
      const filteredData = data.map(hospital => ({
        'Hospital Name': hospital['Hospital Name'] || '',
        'City': hospital['City'] || '',
        'State': hospital['State'] || '',
        'Hospital Type': hospital['Hospital Type'] || '',
        'Hospital overall rating': hospital['Hospital overall rating'] || '',
      })).filter(h => h['Hospital Name']);

      setSearchResults(filteredData);
    } catch (e) {
      console.error("Failed to fetch hospitals:", e);
      setSearchResults([]);
    } finally {
      setIsLoading(prev => ({ ...prev, hospitals: false }));
    }
  }, [selectedState, selectedCity]);

  const openBookingModal = (hospital) => {
    setBookingHospital(hospital);
  };

  const closeBookingModal = () => {
    setBookingHospital(null);
  };

  const handleBook = (newBooking) => {
    const updatedBookings = [...bookings, newBooking];
    setBookings(updatedBookings);
    saveBookings(updatedBookings);
  };

  const handleCancelBooking = (index) => {
    const updatedBookings = bookings.filter((_, i) => i !== index);
    setBookings(updatedBookings);
    saveBookings(updatedBookings);
  };

  const navigate = (newRoute) => {
    const path = newRoute === 'MyBookings' ? '/my-bookings' : '/';
    window.history.pushState({}, '', path);
    setRoute(newRoute);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navbar */}
      <nav className="bg-white shadow-lg sticky top-0 z-40 border-b-2 border-blue-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🏥</div>
              <span className="text-3xl font-extrabold text-blue-600">Medify</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => navigate('Home')}
                className={`font-semibold transition-all py-2 ${
                  route === 'Home' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Find Doctors
              </button>
              <button className="font-semibold text-gray-700 hover:text-blue-600 transition-all">
                Hospitals
              </button>
              <button className="font-semibold text-gray-700 hover:text-blue-600 transition-all">
                Medicines
              </button>
              <button className="font-semibold text-gray-700 hover:text-blue-600 transition-all">
                Surgeries
              </button>
              <button 
                onClick={() => navigate('MyBookings')}
                className={`font-semibold transition-all py-2 ${
                  route === 'MyBookings' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                My Bookings
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t pt-4">
              <button 
                onClick={() => navigate('Home')}
                className={`block w-full text-left py-2 px-4 rounded-lg font-semibold ${
                  route === 'Home' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                Find Doctors
              </button>
              <button 
                onClick={() => navigate('MyBookings')}
                className={`block w-full text-left py-2 px-4 rounded-lg font-semibold mt-2 ${
                  route === 'MyBookings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                My Bookings
              </button>
            </div>
          )}
        </div>
      </nav>

      <main>
        {route === 'Home' && (
          <HomePage 
            states={states}
            cities={cities}
            selectedState={selectedState}
            setSelectedState={setSelectedState}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            handleSearch={handleSearch}
            searchResults={searchResults}
            isLoading={isLoading}
            openBookingModal={openBookingModal}
          />
        )}
        
        {route === 'MyBookings' && (
          <MyBookingsPage 
            bookings={bookings} 
            onCancelBooking={handleCancelBooking} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="text-3xl">🏥</div>
              <span className="text-2xl font-bold text-blue-400">Medify</span>
            </div>
            <div className="flex justify-center gap-6 mb-4 text-sm">
              <a href="#" className="hover:text-blue-400 transition-colors">About Us</a>
              <a href="#" className="hover:text-blue-400 transition-colors">Our Pricing</a>
              <a href="#" className="hover:text-blue-400 transition-colors">Our Gallery</a>
              <a href="#" className="hover:text-blue-400 transition-colors">Appointment</a>
              <a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
            </div>
            <p className="text-sm text-gray-400">
              Copyright ©2023 Surya Nursing Home.com. All Rights Reserved
            </p>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      {bookingHospital && (
        <BookingModal 
          hospital={bookingHospital} 
          onClose={closeBookingModal} 
          onBook={handleBook} 
        />
      )}
    </div>
  );
};

export default App;
