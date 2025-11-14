import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Calendar, Clock, MapPin, Star, X } from 'lucide-react';

// --- CONSTANTS AND HELPERS ---

// Base URL for the MedData API
const API_BASE_URL = 'https://meddata-backend.onrender.com';

// Utility function for exponential backoff during API calls
const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      console.warn(`Request failed for ${url}. Retrying in ${delay / 1000}s...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Function to safely interact with localStorage
const getBookings = () => {
  try {
    const stored = localStorage.getItem('bookings');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error retrieving bookings from localStorage:", error);
    return [];
  }
};

const saveBookings = (bookings) => {
  try {
    localStorage.setItem('bookings', JSON.stringify(bookings));
  } catch (error) {
    console.error("Error saving bookings to localStorage:", error);
  }
};


// --- CUSTOM COMPONENTS ---

/**
 * Reusable Dropdown Component for State and City selection.
 */
const Dropdown = ({ id, label, value, options = [], onSelect, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filter options based on user typing
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredOptions = useMemo(() => 
    options.filter(option => {
      // Ensure options are strings before filtering
      if (typeof option === 'string') {
        return option.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    }), [options, searchTerm]
  );
  
  // Reset search term when value changes
  useEffect(() => {
    setSearchTerm('');
  }, [options]);

  const handleSelect = (option) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div id={id} className="relative w-full">
      <label className="text-gray-600 text-sm font-medium">{label}</label>
      <div 
        className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white shadow-sm transition-all hover:border-blue-500 cursor-pointer" 
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}>
          {value || `Select ${label}`}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder={`Search ${label}...`}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()} // Prevent closing on click
              />
          </div>
          
          {isLoading ? (
            <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">No options found.</div>
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

/**
 * Renders a single hospital card and handles the booking interaction.
 */
const HospitalCard = ({ hospital, onBookAppointment }) => {
  // Use String() for safety before parsing
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
    <div className="bg-white p-5 rounded-xl shadow-lg flex flex-col md:flex-row gap-4 border border-gray-100 transition-shadow hover:shadow-2xl">
      <div className="flex-grow">
        <h3 className="text-xl font-bold text-gray-800 mb-1 capitalize">
          {hospital['Hospital Name'].toLowerCase()}
        </h3>
        <p className="text-sm text-gray-600 mb-2 flex items-center">
          <MapPin className="w-4 h-4 mr-1 text-red-500" />
          {hospital.City}, {hospital.State}
        </p>
        
        <div className="flex items-center mb-4">
          <span className="flex mr-2">{stars}</span>
          <span className="text-sm font-semibold text-gray-700">{rating.toFixed(1)} / 5</span>
          <span className="text-xs text-gray-500 ml-2">({hospital['Hospital Type']})</span>
        </div>

        <button 
          onClick={() => onBookAppointment(hospital)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-full transition-colors shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 mt-2"
        >
          Book FREE Center Visit
        </button>
      </div>
      <div className="flex-shrink-0 flex justify-center items-center p-4 bg-blue-50 rounded-lg">
        <Calendar className="w-10 h-10 text-blue-500" />
      </div>
    </div>
  );
};

/**
 * Modal for selecting date and time for an appointment.
 */
const BookingModal = ({ hospital, onClose, onBook }) => {
  // Use dates for the next 7 days
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

  // Time slots for the test case
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all overflow-hidden scale-100">
        <div className="p-6 border-b flex justify-between items-center bg-blue-50">
          <h2 className="text-2xl font-bold text-gray-800">Book Appointment</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <h3 className="text-lg font-semibold mb-3 text-blue-600 capitalize">
            {hospital['Hospital Name'].toLowerCase()}
          </h3>
          <p className="text-sm text-gray-500 mb-6 flex items-center">
            <MapPin className="w-4 h-4 mr-1 text-red-500" />
            {hospital.City}, {hospital.State}
          </p>

          <div className="mb-6">
            <h4 className="font-bold text-lg text-gray-700 mb-3 flex items-center"><Calendar className="w-5 h-5 mr-2 text-blue-500"/> Select Date:</h4>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {dates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 p-3 rounded-xl border-2 text-center transition-all min-w-[70px] 
                    ${selectedDate.toDateString() === date.toDateString() 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50 shadow-sm'
                    }`}
                >
                  <p className="text-sm font-medium">{isToday(date) ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-xl font-bold">{date.getDate()}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-lg text-gray-700 mb-3 flex items-center"><Clock className="w-5 h-5 mr-2 text-blue-500"/> Select Time Slot:</h4>
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(timeSlots).map(([period, slots]) => (
                <div key={period} className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-extrabold text-blue-700 mb-3">{period}</p>
                  <div className="flex flex-wrap gap-3">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`px-4 py-2 text-sm rounded-full border transition-all shadow-sm 
                          ${selectedTimeSlot === slot 
                            ? 'bg-green-600 border-green-600 text-white font-semibold shadow-lg' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-green-50'
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

        <div className="p-6 border-t flex justify-end bg-gray-50">
          <button
            onClick={handleBook}
            disabled={!selectedDate || !selectedTimeSlot}
            className={`font-extrabold py-3 px-8 rounded-full transition-all shadow-xl
              ${selectedDate && selectedTimeSlot 
                ? 'bg-green-500 hover:bg-green-600 text-white transform hover:scale-105 focus:ring-4 focus:ring-green-300' 
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

/**
 * Main search page (Home)
 */
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
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-16 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 md:p-12 rounded-2xl shadow-xl border-b-4 border-blue-200">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-800 mb-3 leading-tight">Find Online <span className="text-blue-600">Medical Centers</span> <span className="text-red-500">24/7</span></h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">Connect instantly with a specialist or choose to video visit a particular doctor.</p>
        <button className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">Find Top Doctors</button>
      </div>

      {/* Search Bar Section */}
      <div className="bg-white p-6 md:p-10 rounded-2xl shadow-2xl max-w-5xl mx-auto -mt-24 relative z-10 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            type="submit"
            onClick={handleSearch}
            disabled={!selectedState || !selectedCity || isLoading.hospitals}
            className="w-full h-12 md:mt-7 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-4 rounded-xl transition-colors shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]"
          >
            {isLoading.hospitals ? 'Searching...' : 'Search Hospitals'}
          </button>
        </div>
        
        {/* Quick Links */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-4 md:gap-8 text-center text-gray-600">
            {['Doctors', 'Labs', 'Hospitals', 'Medical Store', 'Ambulance'].map(item => (
                <div 
                    key={item} 
                    className={`p-3 rounded-xl transition-all cursor-pointer transform hover:-translate-y-1 hover:shadow-md 
                        ${item === 'Hospitals' ? 'border-2 border-blue-500 bg-blue-100 text-blue-600 shadow-lg' : 'bg-gray-50 border border-gray-200'} `}
                >
                    <div className="text-3xl mb-1">
                        {item === 'Doctors' && '👨‍⚕️'}
                        {item === 'Labs' && '🔬'}
                        {item === 'Hospitals' && '🏥'}
                        {item === 'Medical Store' && '💊'}
                        {item === 'Ambulance' && '🚑'}
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                </div>
            ))}
        </div>

      </div>

      {/* Search Results Display */}
      <div className="mt-12 max-w-5xl mx-auto">
        {searchResults.length > 0 && (
          <div className="mb-6 px-2">
            <h1 className="text-2xl font-bold text-gray-800">
              <span className="text-blue-600">{searchResults.length}</span> medical centers available in <span className="capitalize">{selectedCity.toLowerCase()}</span>
            </h1>
          </div>
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
          <div className="text-center py-10 bg-white rounded-xl shadow-lg mt-8">
            <X className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-xl text-gray-600 font-medium">No medical centers found for {selectedCity}, {selectedState}.</p>
            <p className="text-sm text-gray-400 mt-1">Try selecting a different city or state.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * My Bookings page
 */
const MyBookingsPage = ({ bookings, onCancelBooking }) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-8 border-b-4 border-blue-100 pb-3">My Bookings</h1>
      
      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-xl border border-gray-200">
          <Calendar className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <p className="text-xl text-gray-600 font-medium">You have no upcoming appointments booked.</p>
          <p className="text-sm text-gray-400 mt-1">Find and book a free center visit on the Home page!</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto">
          {bookings.map((booking, index) => (
            <div key={index} className="bg-white p-5 rounded-xl shadow-lg border border-l-8 border-green-500 hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 capitalize">
                {booking['Hospital Name'].toLowerCase()}
              </h3>
              <p className="text-sm text-gray-600 mb-4 flex items-center">
                <MapPin className="w-4 h-4 mr-1 text-red-500"/> {booking.City}, {booking.State} | Type: {booking['Hospital Type']}
              </p>
              
              <div className="flex flex-wrap gap-4 text-base font-semibold border-t pt-3 mt-3">
                <p className="flex items-center text-green-600">
                  <Calendar className="w-5 h-5 mr-2" />
                  {new Date(booking.bookingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="flex items-center text-green-600">
                  <Clock className="w-5 h-5 mr-2" />
                  {booking.bookingTime}
                </p>
              </div>

              <button
                onClick={() => onCancelBooking(index)}
                className="mt-4 text-red-500 hover:text-red-700 text-sm font-medium transition-colors hover:underline"
              >
                Cancel Booking
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---

const App = () => {
  const [route, setRoute] = useState(window.location.pathname === '/my-bookings' ? 'MyBookings' : 'Home');
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [bookings, setBookings] = useState(getBookings);
  const [bookingHospital, setBookingHospital] = useState(null); // Hospital object for modal

  const [isLoading, setIsLoading] = useState({
    states: false,
    cities: false,
    hospitals: false,
  });

  // Load initial bookings and handle history navigation
  useEffect(() => {
    // Handle history changes for routing
    const handlePopState = () => {
        setRoute(window.location.pathname === '/my-bookings' ? 'MyBookings' : 'Home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- API FETCH LOGIC ---

  // 1. Fetch States
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

  // 2. Fetch Cities when a State is selected
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
        const url = `${API_BASE_URL}/cities?state=${encodeURIComponent(selectedState)}`;
        const data = await fetchWithRetry(url);
        setCities(data.map(item => item.city).sort());
      } catch (e) {
        console.error("Failed to fetch cities:", e);
      } finally {
        setIsLoading(prev => ({ ...prev, cities: false }));
      }
    };

    fetchCities();
  }, [selectedState]);


  // 3. Search Hospitals
  const handleSearch = useCallback(async () => {
    if (!selectedState || !selectedCity) return;

    setIsLoading(prev => ({ ...prev, hospitals: true }));
    setSearchResults([]);
    try {
      // API endpoint is meddata-backend.onrender.com/data?state=<state-name>&city=<city-name>
      const url = `${API_BASE_URL}/data?state=${encodeURIComponent(selectedState)}&city=${encodeURIComponent(selectedCity)}`;
      const data = await fetchWithRetry(url);
      
      // Filter the data to ensure we only keep the required fields from the sample JSON
      const filteredData = data.map(hospital => ({
          'Hospital Name': hospital['Hospital Name'] || '',
          'City': hospital['City'] || '',
          'State': hospital['State'] || '',
          'Hospital Type': hospital['Hospital Type'] || '',
          'Hospital overall rating': hospital['Hospital overall rating'] || '',
      })).filter(h => h['Hospital Name']); // Filter out entries with no name

      setSearchResults(filteredData);
    } catch (e) {
      console.error("Failed to fetch hospitals:", e);
      setSearchResults([]);
    } finally {
      setIsLoading(prev => ({ ...prev, hospitals: false }));
    }
  }, [selectedState, selectedCity]);

  // --- BOOKING LOGIC ---
  
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

  // --- ROUTING LOGIC ---
  
  const navigate = (newRoute) => {
    let path = '/';
    if (newRoute === 'MyBookings') {
        path = '/my-bookings';
    }
    
    // Update the history and route state
    window.history.pushState({}, '', path);
    setRoute(newRoute);
  };


  // --- LAYOUT ---
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      
      {/* Navbar */}
      <nav className="bg-white shadow-lg sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-3xl font-extrabold text-blue-600 tracking-wider">
            Medify
          </div>
          <div className="flex space-x-6">
            <button 
              onClick={() => navigate('Home')}
              className={`font-semibold text-gray-700 hover:text-blue-600 transition-colors py-1 ${route === 'Home' ? 'text-blue-600 border-b-2 border-blue-600' : ''}`}
            >
              Home
            </button>
            <button 
              onClick={() => navigate('MyBookings')}
              className={`font-semibold text-gray-700 hover:text-blue-600 transition-colors py-1 ${route === 'MyBookings' ? 'text-blue-600 border-b-2 border-blue-600' : ''}`}
            >
              My Bookings
            </button>
          </div>
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
      <footer className="bg-gray-800 text-white mt-12 py-8">
        <div className="container mx-auto px-4 text-center">
            <div className="text-2xl font-bold text-blue-300 mb-4">Medify</div>
            <p className="text-sm text-gray-400">Copyright © 2023 Surya Nursing Home.com. All Rights Reserved.</p>
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