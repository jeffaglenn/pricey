import './style.css'
import Alpine from 'alpinejs'
import { dashboard } from './dashboard.js'

// Register Alpine.js components
Alpine.data('dashboard', dashboard);

// Start Alpine.js
Alpine.start();

console.log('💰 Pricey Dashboard - Modern Vite Build');