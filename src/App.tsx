import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { db } from './lib/db';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import MasterData from './pages/MasterData';
import Trips from './pages/Trips';
import Invoices from './pages/Invoices';
import Slips from './pages/Slips';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { path: '', element: <Dashboard /> },
      { path: 'master', element: <MasterData /> },
      { path: 'trips', element: <Trips /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'slips', element: <Slips /> },
      { path: 'finance', element: <Finance /> },
      { path: 'settings', element: <Settings /> },
      { path: 'onboarding', element: <Onboarding /> },
    ],
  },
]);

export default function App() {
  useEffect(() => {
    // Terapkan Mode Gelap
    const theme = localStorage.getItem('logistik_theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Terapkan Ukuran Teks
    const size = localStorage.getItem('logistik_text_size') || 'normal';
    if (size === 'small') {
      document.documentElement.style.fontSize = '14px';
    } else if (size === 'large') {
      document.documentElement.style.fontSize = '18px';
    } else {
      document.documentElement.style.fontSize = '16px';
    }
    // Auto-migrate old trips to CBM
    const migrateOldTrips = async () => {
      try {
        const cbmMaterial = await db.jenisMaterials.where('nama_material').equalsIgnoreCase('CBM').first();
        if (cbmMaterial) {
          const oldTrips = await db.trips.filter(t => !t.jenis_material_id).toArray();
          if (oldTrips.length > 0) {
            const updates = oldTrips.map(t => ({ ...t, jenis_material_id: cbmMaterial.id }));
            await db.trips.bulkPut(updates);
            console.log(`Migrated ${oldTrips.length} old trips to CBM`);
          }
        }
      } catch (e) {
        console.error('Migration error:', e);
      }
    };
    migrateOldTrips();
  }, []);

  return <RouterProvider router={router} />;
}
