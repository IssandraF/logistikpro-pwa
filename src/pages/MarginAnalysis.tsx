import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { 
  DollarSign, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Building2, 
  Layers, 
  PieChart as PieChartIcon, 
  BarChart3,
  Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

export default function MarginAnalysis() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProyekIds, setSelectedProyekIds] = useState<number[]>([]);
  const [selectedGrupIds, setSelectedGrupIds] = useState<number[]>([]);
  const [includePotonganMaterial, setIncludePotonganMaterial] = useState(true);

  // State input manual harga per rit untuk setiap Kuari { kuari_id: harga_per_rit }
  const [kuariHargaMap, setKuariHargaMap] = useState<Record<number, number>>({});

  // Fetch Master Data
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.toArray());
  const lokasiKuaris = useLiveQuery(() => db.lokasiKuaris.toArray());

  // Fetch Trips yang sudah punya Invoice & Slip Pembayaran
  const completedTrips = useLiveQuery(
    () => db.trips.filter(t => t.invoice_id !== null && t.slip_pembayaran_id !== null && t.isDeleted === 0).toArray()
  );

  const getProyekIdByLokasi = (proyekLokasiId: number) => {
    return proyekLokasis?.find(pl => pl.id === proyekLokasiId)?.proyek_id || 0;
  };

  const getProyekName = (proyekId: number) => {
    return proyeks?.find(p => p.id === proyekId)?.nama_proyek || 'Unknown Proyek';
  };

  const getGrupName = (grupId: number) => {
    return grupMobils?.find(g => g.id === grupId)?.nama_grup || 'Unknown Grup';
  };

  const getKuariName = (kuariId: number) => {
    return lokasiKuaris?.find(k => k.id === kuariId)?.nama_lokasi || 'Kuari ' + kuariId;
  };

  // Helper input handler untuk harga kuari
  const handleKuariHargaChange = (kuariId: number, val: number) => {
    setKuariHargaMap(prev => ({
      ...prev,
      [kuariId]: Math.max(0, val)
    }));
  };

  // Aggregation & Financial Calculation Logic
  const {
    filteredTrips,
    summaryPemasukan,
    summaryPembayaranSlip,
    summaryPembayaranTanah,
    totals
  } = useMemo(() => {
    if (!completedTrips || !proyeks || !grupMobils || !proyekLokasis || !lokasiKuaris) {
      return {
        filteredTrips: [],
        summaryPemasukan: [],
        summaryPembayaranSlip: [],
        summaryPembayaranTanah: [],
        totals: {
          pemasukanVol: 0,
          pemasukanRit: 0,
          totalPemasukan: 0,
          slipVol: 0,
          slipRit: 0,
          totalPotongTanah: 0,
          totalPengeluaranSlip: 0,
          tanahRit: 0,
          tanahVol: 0,
          totalPengeluaranTanah: 0,
          totalPengeluaran: 0,
          netProfit: 0,
          marginPct: 0
        }
      };
    }

    // 1. Filter Trips
    const filtered = completedTrips.filter(t => {
      const tripDate = new Date(t.tanggal_bongkar);
      tripDate.setHours(0, 0, 0, 0);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (tripDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (tripDate > end) return false;
      }

      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);
      if (selectedProyekIds.length > 0 && !selectedProyekIds.includes(pId)) return false;
      if (selectedGrupIds.length > 0 && !selectedGrupIds.includes(t.grup_mobil_id)) return false;

      return true;
    });

    // 2. Summary Pemasukan (Group by Proyek)
    const pemasukanMap: Record<number, { proyekId: number; proyekName: string; rit: number; volume: number; totalHarga: number }> = {};
    filtered.forEach(t => {
      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);
      if (!pemasukanMap[pId]) {
        pemasukanMap[pId] = {
          proyekId: pId,
          proyekName: getProyekName(pId),
          rit: 0,
          volume: 0,
          totalHarga: 0
        };
      }
      pemasukanMap[pId].rit += 1;
      pemasukanMap[pId].volume += t.volume;
      pemasukanMap[pId].totalHarga += t.total_harga;
    });
    const listPemasukan = Object.values(pemasukanMap);

    // 3. Summary Pembayaran Slip (Group by Grup Truk -> Proyek)
    // Structure: { grupId: { grupName, proyeks: { proyekId: { volume, rit, hargaBayarAvg, potongan, jumlahSlip } } } }
    const slipMap: Record<number, {
      grupId: number;
      grupName: string;
      proyekMap: Record<number, { proyekId: number; proyekName: string; volume: number; rit: number; potongan: number; jumlahSlip: number }>;
      totalVolGrup: number;
      totalRitGrup: number;
      totalPotongGrup: number;
      totalSlipGrup: number;
    }> = {};

    filtered.forEach(t => {
      const gId = t.grup_mobil_id;
      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);

      if (!slipMap[gId]) {
        slipMap[gId] = {
          grupId: gId,
          grupName: getGrupName(gId),
          proyekMap: {},
          totalVolGrup: 0,
          totalRitGrup: 0,
          totalPotongGrup: 0,
          totalSlipGrup: 0
        };
      }

      if (!slipMap[gId].proyekMap[pId]) {
        slipMap[gId].proyekMap[pId] = {
          proyekId: pId,
          proyekName: getProyekName(pId),
          volume: 0,
          rit: 0,
          potongan: 0,
          jumlahSlip: 0
        };
      }

      const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
      const potongan = t.potongan_trip || 0;
      const costSlip = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;

      slipMap[gId].proyekMap[pId].rit += 1;
      slipMap[gId].proyekMap[pId].volume += t.volume;
      slipMap[gId].proyekMap[pId].potongan += potongan;
      slipMap[gId].proyekMap[pId].jumlahSlip += costSlip;

      slipMap[gId].totalRitGrup += 1;
      slipMap[gId].totalVolGrup += t.volume;
      slipMap[gId].totalPotongGrup += potongan;
      slipMap[gId].totalSlipGrup += costSlip;
    });

    const listPembayaranSlip = Object.values(slipMap);

    // 4. Summary Pembayaran Tanah (Group by Kuari)
    const tanahMap: Record<number, { kuariId: number; kuariName: string; rit: number; volume: number }> = {};
    filtered.forEach(t => {
      const kId = t.lokasi_kuari_id;
      if (!tanahMap[kId]) {
        tanahMap[kId] = {
          kuariId: kId,
          kuariName: getKuariName(kId),
          rit: 0,
          volume: 0
        };
      }
      tanahMap[kId].rit += 1;
      tanahMap[kId].volume += t.volume;
    });

    const listPembayaranTanah = Object.values(tanahMap).map(k => {
      const hargaPerRit = kuariHargaMap[k.kuariId] ?? 0;
      const totalJumlah = k.rit * hargaPerRit;
      return {
        ...k,
        hargaPerRit,
        totalJumlah
      };
    });

    // 5. Totals & Profit Calculations
    const pemasukanVol = listPemasukan.reduce((acc, x) => acc + x.volume, 0);
    const pemasukanRit = listPemasukan.reduce((acc, x) => acc + x.rit, 0);
    const totalPemasukan = listPemasukan.reduce((acc, x) => acc + x.totalHarga, 0);

    const slipVol = listPembayaranSlip.reduce((acc, x) => acc + x.totalVolGrup, 0);
    const slipRit = listPembayaranSlip.reduce((acc, x) => acc + x.totalRitGrup, 0);
    const totalPotongTanah = listPembayaranSlip.reduce((acc, x) => acc + x.totalPotongGrup, 0);
    const totalPengeluaranSlip = listPembayaranSlip.reduce((acc, x) => acc + x.totalSlipGrup, 0);

    const tanahRit = listPembayaranTanah.reduce((acc, x) => acc + x.rit, 0);
    const tanahVol = listPembayaranTanah.reduce((acc, x) => acc + x.volume, 0);
    const totalPengeluaranTanah = listPembayaranTanah.reduce((acc, x) => acc + x.totalJumlah, 0);

    const totalPengeluaran = totalPengeluaranSlip + totalPengeluaranTanah;
    const netProfit = totalPemasukan - totalPengeluaran;
    const marginPct = totalPemasukan > 0 ? (netProfit / totalPemasukan) * 100 : 0;

    return {
      filteredTrips: filtered,
      summaryPemasukan: listPemasukan,
      summaryPembayaranSlip: listPembayaranSlip,
      summaryPembayaranTanah: listPembayaranTanah,
      totals: {
        pemasukanVol,
        pemasukanRit,
        totalPemasukan,
        slipVol,
        slipRit,
        totalPotongTanah,
        totalPengeluaranSlip,
        tanahRit,
        tanahVol,
        totalPengeluaranTanah,
        totalPengeluaran,
        netProfit,
        marginPct
      }
    };
  }, [completedTrips, proyeks, grupMobils, proyekLokasis, lokasiKuaris, startDate, endDate, selectedProyekIds, selectedGrupIds, includePotonganMaterial, kuariHargaMap]);

  const toggleProyek = (id: number) => {
    setSelectedProyekIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleGrup = (id: number) => {
    setSelectedGrupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const formatRp = (num: number) => `Rp ${Math.round(num).toLocaleString('id-ID')}`;

  // Chart Data Preparation
  const barChartData = [
    { name: 'Pemasukan', Nominal: totals.totalPemasukan, fill: '#16a34a' },
    { name: 'Bayar Slip', Nominal: totals.totalPengeluaranSlip, fill: '#dc2626' },
    { name: 'Bayar Kuari', Nominal: totals.totalPengeluaranTanah, fill: '#ea580c' },
    { name: 'Net Profit', Nominal: Math.max(0, totals.netProfit), fill: '#2563eb' }
  ];

  const pieChartData = [
    { name: 'Ongkos Slip Vendor', value: totals.totalPengeluaranSlip, color: '#dc2626' },
    { name: 'Pembayaran Kuari', value: totals.totalPengeluaranTanah, color: '#ea580c' }
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 relative" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      
      {/* Header Print (Sembunyi di Layar, Muncul saat Diprint) */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Rekap Pemasukan dan Pengeluaran</h1>
        <p className="text-sm text-gray-700 mt-1">
          Periode: {startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'Semua Data'} s/d {endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Sekarang'}
        </p>
        <div className="border-b-2 border-black w-full mt-3 mb-4"></div>
      </div>

      {/* Top Action Bar */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analisis Margin & Keuntungan</h1>
          <p className="text-sm text-muted-foreground">Rekap Pemasukan Proyek, Pengeluaran Slip Vendor, dan Pembayaran Tanah Kuari</p>
        </div>
        <Button variant="outline" className="shadow-sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Cetak Rekap Laporan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Sidebar Filter & Input Kuari (Sembunyi saat Print) */}
        <div className="lg:col-span-1 print:hidden space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Filter Periode & Entitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label>Mulai Tanggal Bongkar</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sampai Tanggal Bongkar</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              
              <div className="space-y-1.5">
                <Label>Filter Proyek</Label>
                <div className="max-h-28 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/20">
                  {proyeks?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <input 
                        type="checkbox"
                        id={`p-${p.id}`} 
                        checked={selectedProyekIds.includes(p.id!)}
                        onChange={() => toggleProyek(p.id!)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`p-${p.id}`} className="text-xs font-medium cursor-pointer truncate">
                        {p.nama_proyek}
                      </label>
                    </div>
                  ))}
                  {proyeks?.length === 0 && <span className="text-xs text-muted-foreground">Tidak ada data</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Filter Grup Truk Vendor</Label>
                <div className="max-h-28 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-muted/20">
                  {grupMobils?.map(g => (
                    <div key={g.id} className="flex items-center space-x-2">
                      <input 
                        type="checkbox"
                        id={`g-${g.id}`} 
                        checked={selectedGrupIds.includes(g.id!)}
                        onChange={() => toggleGrup(g.id!)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={`g-${g.id}`} className="text-xs font-medium cursor-pointer truncate">
                        {g.nama_grup}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t">
                <input 
                  type="checkbox"
                  id="inc-material" 
                  checked={includePotonganMaterial}
                  onChange={(e) => setIncludePotonganMaterial(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="inc-material" className="text-xs font-medium cursor-pointer">
                  Kurangkan Potongan Material pada Slip Vendor
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Form Input Manual Harga Kuari per Rit */}
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-950">
                <Coins className="w-4 h-4 text-orange-600" /> Input Harga Kuari (per Rit)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryPembayaranTanah.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada kuari dalam filter trip terpilih.</p>
              ) : (
                summaryPembayaranTanah.map(k => (
                  <div key={k.kuariId} className="space-y-1 bg-white p-2.5 rounded border border-orange-200 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-medium text-gray-800">
                      <span>{k.kuariName}</span>
                      <span className="text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded text-[11px] font-semibold">{k.rit} Rit</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 font-semibold">Rp</span>
                      <Input
                        type="number"
                        placeholder="Harga per Rit"
                        value={k.hargaPerRit || ''}
                        onChange={e => handleKuariHargaChange(k.kuariId, Number(e.target.value))}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Section */}
        <div className="lg:col-span-3 space-y-6 print:col-span-4 w-full">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 break-inside-avoid">
            <Card className="border-green-200 bg-green-50/40 print:bg-gray-50 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs text-green-700 font-semibold uppercase tracking-wider print:text-black">Pemasukan Invoice</p>
                  <h3 className="text-xl font-bold mt-1 text-green-700 print:text-black">{formatRp(totals.totalPemasukan)}</h3>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-green-600 print:text-gray-700 font-medium">
                  <span>{totals.pemasukanRit} Rit</span>
                  <span>{totals.pemasukanVol.toLocaleString('id-ID')} m³</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/40 print:bg-gray-50 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs text-red-700 font-semibold uppercase tracking-wider print:text-black">Pembayaran Slip</p>
                  <h3 className="text-xl font-bold mt-1 text-red-700 print:text-black">{formatRp(totals.totalPengeluaranSlip)}</h3>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-red-600 print:text-gray-700 font-medium">
                  <span>{totals.slipRit} Rit</span>
                  <span>{totals.slipVol.toLocaleString('id-ID')} m³</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50/40 print:bg-gray-50 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs text-orange-700 font-semibold uppercase tracking-wider print:text-black">Pembayaran Kuari</p>
                  <h3 className="text-xl font-bold mt-1 text-orange-700 print:text-black">{formatRp(totals.totalPengeluaranTanah)}</h3>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-orange-600 print:text-gray-700 font-medium">
                  <span>{totals.tanahRit} Rit</span>
                  <span>{totals.tanahVol.toLocaleString('id-ID')} m³</span>
                </div>
              </CardContent>
            </Card>

            <Card className={totals.netProfit >= 0 ? "bg-blue-600 text-white print:bg-gray-200 print:text-black print:border-gray-400" : "bg-red-600 text-white print:bg-red-100 print:text-black"}>
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Keuntungan (Profit)</p>
                  <h3 className="text-xl font-bold mt-1">{formatRp(totals.netProfit)}</h3>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
                  {totals.netProfit >= 0 ? <TrendingUp className="w-4 h-4 print:hidden" /> : <TrendingDown className="w-4 h-4 print:hidden" />}
                  <span>Margin: {totals.marginPct.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Recharts Graphs (Hanya Tampil di Layar / Hidden on Print) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Perbandingan Pemasukan & Pengeluaran
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `Rp ${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: any) => [formatRp(Number(value)), 'Nominal']} />
                    <Bar dataKey="Nominal" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" /> Komposisi Pengeluaran
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 pt-2">
                {pieChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Belum ada data pengeluaran</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatRp(Number(val))} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {filteredTrips.length === 0 ? (
            <Card className="print:hidden">
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada data trip (Invoice & Slip Lunas) yang memenuhi kriteria filter.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              
              {/* TABEL 1: REKAP PEMASUKAN DAN PENGELUARAN (TAGIHAN PROYEK) */}
              <Card className="break-inside-avoid border shadow-sm print:shadow-none print:border-black">
                <CardHeader className="bg-sky-600 text-white p-3 print:bg-sky-500 print:text-white">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 print:hidden" /> Rekap Pemasukan (Invoice Proyek)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground print:bg-gray-200 print:text-black">
                      <tr>
                        <th className="p-2.5 w-10 text-center border-r">No</th>
                        <th className="p-2.5 border-r">Proyek</th>
                        <th className="p-2.5 text-center border-r">Rit</th>
                        <th className="p-2.5 text-right border-r">Volume / M²</th>
                        <th className="p-2.5 text-right border-r">Harga Unit</th>
                        <th className="p-2.5 text-right border-r">Jumlah</th>
                        <th className="p-2.5 text-right font-bold">Total Pemasukan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryPemasukan.map((p, idx) => {
                        const hargaAvg = p.volume > 0 ? p.totalHarga / p.volume : 0;
                        return (
                          <tr key={p.proyekId} className="border-b print:border-gray-300">
                            <td className="p-2.5 text-center border-r font-medium">{idx + 1}</td>
                            <td className="p-2.5 border-r font-semibold">{p.proyekName}</td>
                            <td className="p-2.5 text-center border-r">{p.rit}</td>
                            <td className="p-2.5 text-right border-r">{p.volume.toLocaleString('id-ID')}</td>
                            <td className="p-2.5 text-right border-r">{formatRp(hargaAvg)}</td>
                            <td className="p-2.5 text-right border-r font-medium">{formatRp(p.totalHarga)}</td>
                            <td className="p-2.5 text-right font-bold text-green-700 print:text-black">{formatRp(p.totalHarga)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-100 font-bold border-t-2 border-green-300 print:bg-green-200 print:border-black">
                        <td colSpan={2} className="p-2.5 text-right uppercase border-r">Total Pemasukan:</td>
                        <td className="p-2.5 text-center border-r">{totals.pemasukanRit}</td>
                        <td className="p-2.5 text-right border-r">{totals.pemasukanVol.toLocaleString('id-ID')}</td>
                        <td colSpan={2} className="p-2.5 border-r"></td>
                        <td className="p-2.5 text-right text-green-900 print:text-black text-base">{formatRp(totals.totalPemasukan)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* TABEL 2: PEMBAYARAN SLIP (ONGKOS ANGKUT VENDOR) */}
              <Card className="break-inside-avoid border shadow-sm print:shadow-none print:border-black">
                <CardHeader className="bg-emerald-700 text-white p-3 print:bg-emerald-600 print:text-white">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4 print:hidden" /> Pembayaran Slip (Ongkos Angkut Armada)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground print:bg-gray-200 print:text-black">
                      <tr>
                        <th className="p-2.5 w-10 text-center border-r">No</th>
                        <th className="p-2.5 border-r">Grup Mobil</th>
                        <th className="p-2.5 border-r">Proyek</th>
                        <th className="p-2.5 text-right border-r">Volume / M²</th>
                        <th className="p-2.5 text-center border-r">Rit</th>
                        <th className="p-2.5 text-right border-r">Harga Ongkos</th>
                        <th className="p-2.5 text-right border-r">Potong Tanah</th>
                        <th className="p-2.5 text-right border-r">Jumlah Slip</th>
                        <th className="p-2.5 text-right font-bold">Total Grup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryPembayaranSlip.map((grup, idx) => {
                        const proyekItems = Object.values(grup.proyekMap);
                        return proyekItems.map((p, pIdx) => {
                          const hargaOngkos = p.volume > 0 ? (p.jumlahSlip + p.potongan) / p.volume : 0;
                          return (
                            <tr key={`${grup.grupId}-${p.proyekId}`} className="border-b print:border-gray-300">
                              {pIdx === 0 ? (
                                <>
                                  <td rowSpan={proyekItems.length} className="p-2.5 text-center border-r font-medium align-top bg-muted/10 print:bg-white">{idx + 1}</td>
                                  <td rowSpan={proyekItems.length} className="p-2.5 border-r font-semibold align-top bg-muted/10 print:bg-white">{grup.grupName}</td>
                                </>
                              ) : null}
                              <td className="p-2.5 border-r">{p.proyekName}</td>
                              <td className="p-2.5 text-right border-r">{p.volume.toLocaleString('id-ID')}</td>
                              <td className="p-2.5 text-center border-r">{p.rit}</td>
                              <td className="p-2.5 text-right border-r">{formatRp(hargaOngkos)}</td>
                              <td className="p-2.5 text-right border-r text-red-600 print:text-black">{formatRp(p.potongan)}</td>
                              <td className="p-2.5 text-right border-r font-medium">{formatRp(p.jumlahSlip)}</td>
                              {pIdx === 0 ? (
                                <td rowSpan={proyekItems.length} className="p-2.5 text-right font-bold border-l align-middle text-emerald-800 print:text-black bg-emerald-50/30 print:bg-white">
                                  {formatRp(grup.totalSlipGrup)}
                                </td>
                              ) : null}
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-100 font-bold border-t-2 border-emerald-300 print:bg-emerald-200 print:border-black">
                        <td colSpan={3} className="p-2.5 text-right uppercase border-r">Total Pembayaran Slip:</td>
                        <td className="p-2.5 text-right border-r">{totals.slipVol.toLocaleString('id-ID')}</td>
                        <td className="p-2.5 text-center border-r">{totals.slipRit}</td>
                        <td className="p-2.5 border-r"></td>
                        <td className="p-2.5 text-right border-r text-red-700 print:text-black">{formatRp(totals.totalPotongTanah)}</td>
                        <td className="p-2.5 text-right border-r"></td>
                        <td className="p-2.5 text-right text-emerald-950 print:text-black text-base">{formatRp(totals.totalPengeluaranSlip)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* TABEL 3: PEMBAYARAN TANAH (KUARI) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 break-inside-avoid">
                <Card className="border shadow-sm print:shadow-none print:border-black">
                  <CardHeader className="bg-amber-600 text-white p-3 print:bg-amber-600 print:text-white">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                      <Coins className="w-4 h-4 print:hidden" /> Pembayaran Tanah (Material Kuari)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground print:bg-gray-200 print:text-black">
                        <tr>
                          <th className="p-2.5 w-10 text-center border-r">No</th>
                          <th className="p-2.5 border-r">Kuari</th>
                          <th className="p-2.5 text-center border-r">Rit</th>
                          <th className="p-2.5 text-right border-r">Harga per Rit</th>
                          <th className="p-2.5 text-right font-bold">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryPembayaranTanah.map((k, idx) => (
                          <tr key={k.kuariId} className="border-b print:border-gray-300">
                            <td className="p-2.5 text-center border-r font-medium">{idx + 1}</td>
                            <td className="p-2.5 border-r font-semibold">{k.kuariName}</td>
                            <td className="p-2.5 text-center border-r">{k.rit}</td>
                            <td className="p-2.5 text-right border-r">{formatRp(k.hargaPerRit)}</td>
                            <td className="p-2.5 text-right font-bold text-amber-900 print:text-black">{formatRp(k.totalJumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-amber-100 font-bold border-t-2 border-amber-300 print:bg-amber-200 print:border-black">
                          <td colSpan={2} className="p-2.5 text-right uppercase border-r">Total Bayar Tanah:</td>
                          <td className="p-2.5 text-center border-r">{totals.tanahRit}</td>
                          <td className="p-2.5 border-r"></td>
                          <td className="p-2.5 text-right text-amber-950 print:text-black text-base">{formatRp(totals.totalPengeluaranTanah)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>

                {/* TABEL 4: RINGKASAN KEUNTUNGAN (PROFIT SUMMARY) */}
                <Card className="border shadow-sm print:shadow-none print:border-black">
                  <CardHeader className="bg-blue-700 text-white p-3 print:bg-blue-700 print:text-white">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                      <DollarSign className="w-4 h-4 print:hidden" /> Rekap Keuntungan (Profit)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground print:bg-gray-200 print:text-black">
                        <tr>
                          <th className="p-2.5 text-center border-r">Pemasukan (Masuk)</th>
                          <th className="p-2.5 text-center border-r">Total Pengeluaran (Keluar)</th>
                          <th className="p-2.5 text-center font-bold">Total Keuntungan</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3 text-center border-r font-semibold text-green-700 print:text-black">
                            {formatRp(totals.totalPemasukan)}
                          </td>
                          <td className="p-3 text-center border-r font-semibold text-red-700 print:text-black">
                            {formatRp(totals.totalPengeluaran)}
                            <div className="text-[11px] text-muted-foreground font-normal mt-0.5 print:text-black">
                              (Slip {formatRp(totals.totalPengeluaranSlip)} + Kuari {formatRp(totals.totalPengeluaranTanah)})
                            </div>
                          </td>
                          <td className={`p-3 text-center font-extrabold text-lg ${totals.netProfit >= 0 ? 'text-blue-700 print:text-black' : 'text-red-700 print:text-black'}`}>
                            {formatRp(totals.netProfit)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-50 font-bold print:bg-gray-200">
                          <td colSpan={2} className="p-2.5 text-right uppercase border-r text-xs">Margin Persentase:</td>
                          <td className="p-2.5 text-center text-blue-900 print:text-black text-sm font-bold">
                            {totals.marginPct.toFixed(2)} %
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
