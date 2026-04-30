import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Truck, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function Dashboard() {
  const kasItems = useLiveQuery(() => db.kas.toArray());
  const pinjamans = useLiveQuery(() => db.pinjamanGrups.toArray());
  const invoices = useLiveQuery(() => db.invoices.toArray());
  const trips = useLiveQuery(() => db.trips.where('isDeleted').equals(0).toArray());

  // 1. Total Saldo Kas
  const totalKas = kasItems?.reduce((acc, curr) => {
    return curr.jenis === 'masuk' ? acc + curr.nominal : acc - curr.nominal;
  }, 0) || 0;

  // 2. Sisa Tagihan (Piutang) dari Invoice yang belum lunas (draft)
  const piutangInvoice = invoices?.filter(i => i.status === 'draft')
    .reduce((acc, curr) => acc + curr.total_harga_bersih, 0) || 0;

  // 3. Total Sisa Kasbon Vendor
  const sisaKasbon = pinjamans?.reduce((acc, curr) => acc + curr.sisa_kasbon, 0) || 0;

  // 4. Trip Hari Ini
  const today = startOfDay(new Date());
  const tripHariIni = trips?.filter(t => new Date(t.tanggal_bongkar) >= today).length || 0;

  // 5. Chart Data: Trip 7 Hari Terakhir
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(today, 6 - i); // 6 days ago up to today
    const count = trips?.filter(t => {
      const tb = new Date(t.tanggal_bongkar);
      return tb.getDate() === d.getDate() && tb.getMonth() === d.getMonth() && tb.getFullYear() === d.getFullYear();
    }).length || 0;
    
    return {
      name: format(d, 'dd/MM'),
      Trips: count
    };
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard Logistik</h1>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Saldo Kas Utama</p>
              <h2 className="text-2xl font-bold mt-1 text-primary">Rp {totalKas.toLocaleString('id-ID')}</h2>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Wallet className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Piutang Tagihan</p>
              <h2 className="text-2xl font-bold mt-1">Rp {piutangInvoice.toLocaleString('id-ID')}</h2>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Hutang Kasbon Vendor</p>
              <h2 className="text-2xl font-bold mt-1 text-destructive">Rp {sisaKasbon.toLocaleString('id-ID')}</h2>
            </div>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Trip Hari Ini</p>
              <h2 className="text-2xl font-bold mt-1">{tripHariIni} Rit</h2>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <Truck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Aktivitas Trip (7 Hari Terakhir)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="Trips" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
