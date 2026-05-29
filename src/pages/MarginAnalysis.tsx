import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { LineChart, DollarSign, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MarginAnalysis() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProyekIds, setSelectedProyekIds] = useState<number[]>([]);
  const [selectedGrupIds, setSelectedGrupIds] = useState<number[]>([]);
  const [includePotonganMaterial, setIncludePotonganMaterial] = useState(true);

  // Fetch Master Data
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.toArray());

  // Fetch Trips that have both Invoice and Slip
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

  // Filter & Kalkulasi Data
  const { filteredData, summary } = useMemo(() => {
    if (!completedTrips || !proyeks || !grupMobils || !proyekLokasis) {
      return { filteredData: {}, summary: { volume: 0, tagihan: 0, pembayaran: 0, margin: 0 } };
    }

    // 1. Filter Trips
    const filtered = completedTrips.filter(t => {
      // Date Filter
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

      // Proyek Filter
      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);
      if (selectedProyekIds.length > 0 && !selectedProyekIds.includes(pId)) return false;

      // Grup Filter
      if (selectedGrupIds.length > 0 && !selectedGrupIds.includes(t.grup_mobil_id)) return false;

      return true;
    });

    // 2. Group by Proyek
    const grouped: Record<number, typeof filtered> = {};
    let sumVol = 0;
    let sumTagihan = 0;
    let sumPembayaran = 0;

    filtered.forEach(t => {
      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);
      if (!grouped[pId]) grouped[pId] = [];
      grouped[pId].push(t);

      // Kalkulasi Global
      sumVol += t.volume;
      sumTagihan += t.total_harga; // Revenue

      const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
      const potongan = t.potongan_trip || 0;
      
      const realCost = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;
      sumPembayaran += realCost;
    });

    const sumMargin = sumTagihan - sumPembayaran;

    return { 
      filteredData: grouped, 
      summary: { volume: sumVol, tagihan: sumTagihan, pembayaran: sumPembayaran, margin: sumMargin } 
    };
  }, [completedTrips, proyeks, grupMobils, proyekLokasis, startDate, endDate, selectedProyekIds, selectedGrupIds, includePotonganMaterial]);

  const toggleProyek = (id: number) => {
    setSelectedProyekIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleGrup = (id: number) => {
    setSelectedGrupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LineChart className="w-6 h-6 text-primary" /> Analisis Laba / Rugi (Margin Trip)
          </h1>
          <p className="text-muted-foreground mt-1">Rekonsiliasi nilai Invoice vs Pembayaran Slip ke Vendor.</p>
        </div>
        <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Cetak Laporan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6 print:hidden">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">Filter & Pengaturan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mulai Tanggal Bongkar</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal Bongkar</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Filter Proyek</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2 bg-muted/20">
                {proyeks?.map(p => (
                  <div key={p.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`p-${p.id}`} 
                      checked={selectedProyekIds.includes(p.id!)}
                      onCheckedChange={() => toggleProyek(p.id!)}
                    />
                    <label htmlFor={`p-${p.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {p.nama_proyek}
                    </label>
                  </div>
                ))}
                {proyeks?.length === 0 && <span className="text-xs text-muted-foreground">Tidak ada proyek</span>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter Grup Truk Vendor</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2 bg-muted/20">
                {grupMobils?.map(g => (
                  <div key={g.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`g-${g.id}`} 
                      checked={selectedGrupIds.includes(g.id!)}
                      onCheckedChange={() => toggleGrup(g.id!)}
                    />
                    <label htmlFor={`g-${g.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {g.nama_grup}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox 
                id="inc-material" 
                checked={includePotonganMaterial}
                onCheckedChange={(c) => setIncludePotonganMaterial(!!c)}
              />
              <label htmlFor="inc-material" className="text-sm font-medium leading-none cursor-pointer">
                Sertakan Potongan Material (Mengurangi Biaya)
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium">Total Volume</p>
                <h3 className="text-2xl font-bold mt-1">{summary.volume.toLocaleString('id-ID')} m³</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium">Total Tagihan (Revenue)</p>
                <div className="flex items-center gap-1 mt-1 text-green-600">
                  <ArrowUpRight className="w-5 h-5" />
                  <h3 className="text-xl font-bold">{formatRp(summary.tagihan)}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium">Total Pembayaran (Cost)</p>
                <div className="flex items-center gap-1 mt-1 text-red-600">
                  <ArrowDownRight className="w-5 h-5" />
                  <h3 className="text-xl font-bold">{formatRp(summary.pembayaran)}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className={summary.margin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm opacity-90 font-medium">Margin / Laba Kotor</p>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-6 h-6" />
                  <h3 className="text-2xl font-bold">{formatRp(summary.margin)}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rincian per Proyek */}
          <div className="space-y-6">
            {Object.keys(filteredData).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Belum ada data trip yang memenuhi kriteria filter (Atau belum ada trip yang sudah di-invoice & dibayar).
                </CardContent>
              </Card>
            ) : (
              Object.entries(filteredData).map(([pIdStr, trips]) => {
                const pId = Number(pIdStr);
                
                // Subtotal for Project
                let subTagihan = 0;
                let subBiaya = 0;
                let subVol = 0;

                const rows = trips.map(t => {
                  const tagihan = t.total_harga;
                  const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
                  const potongan = t.potongan_trip || 0;
                  const biaya = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;
                  const margin = tagihan - biaya;
                  
                  subTagihan += tagihan;
                  subBiaya += biaya;
                  subVol += t.volume;

                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/30 text-sm">
                      <td className="p-2">{format(new Date(t.tanggal_bongkar), 'dd/MM/yyyy')}</td>
                      <td className="p-2 font-medium">{t.plat_nomor}</td>
                      <td className="p-2">{getGrupName(t.grup_mobil_id)}</td>
                      <td className="p-2 text-right">{t.volume.toLocaleString('id-ID')} m³</td>
                      <td className="p-2 text-right text-green-600">{formatRp(tagihan)}</td>
                      <td className="p-2 text-right text-red-600">{formatRp(biaya)}</td>
                      <td className={`p-2 text-right font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatRp(margin)}
                      </td>
                    </tr>
                  );
                });

                const subMargin = subTagihan - subBiaya;

                return (
                  <Card key={pId} className="overflow-hidden break-inside-avoid shadow-md">
                    <CardHeader className="bg-muted/50 p-4 border-b">
                      <CardTitle className="text-lg flex justify-between items-center">
                        <span>Proyek: {getProyekName(pId)}</span>
                        <span className="text-sm font-normal text-muted-foreground">{trips.length} Trip Terkait</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="p-3">Tanggal</th>
                              <th className="p-3">Plat Nomor</th>
                              <th className="p-3">Grup Truk</th>
                              <th className="p-3 text-right">Volume</th>
                              <th className="p-3 text-right">Tagihan (Inv)</th>
                              <th className="p-3 text-right">Biaya (Slip)</th>
                              <th className="p-3 text-right">Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows}
                            {/* Subtotal Row */}
                            <tr className="bg-primary/5 font-bold text-sm border-t">
                              <td colSpan={3} className="p-3 text-right">SUBTOTAL {getProyekName(pId)} :</td>
                              <td className="p-3 text-right">{subVol.toLocaleString('id-ID')} m³</td>
                              <td className="p-3 text-right text-green-700">{formatRp(subTagihan)}</td>
                              <td className="p-3 text-right text-red-700">{formatRp(subBiaya)}</td>
                              <td className={`p-3 text-right ${subMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatRp(subMargin)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Print-only View (Simplified) */}
      <div className="hidden print:block space-y-6">
         <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Laporan Analisis Margin Trip</h1>
            <p className="text-sm">Periode: {startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'Awal'} s/d {endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Akhir'}</p>
            <p className="text-sm">Potongan Material: {includePotonganMaterial ? 'Disertakan (Mengurangi Biaya)' : 'Tidak Disertakan'}</p>
         </div>

         <div className="grid grid-cols-4 gap-4 text-center mb-8 border-y py-4">
            <div>
              <p className="text-sm">Total Volume</p>
              <p className="font-bold text-lg">{summary.volume.toLocaleString('id-ID')} m³</p>
            </div>
            <div>
              <p className="text-sm">Total Tagihan (Pendapatan)</p>
              <p className="font-bold text-lg">{formatRp(summary.tagihan)}</p>
            </div>
            <div>
              <p className="text-sm">Total Biaya (Pengeluaran)</p>
              <p className="font-bold text-lg">{formatRp(summary.pembayaran)}</p>
            </div>
            <div>
              <p className="text-sm">Total Margin (Laba Kotor)</p>
              <p className="font-bold text-lg">{formatRp(summary.margin)}</p>
            </div>
         </div>

         {Object.entries(filteredData).map(([pIdStr, trips]) => {
            const pId = Number(pIdStr);
            let subTagihan = 0;
            let subBiaya = 0;
            let subVol = 0;
            return (
              <div key={pId} className="mb-6 break-inside-avoid">
                <h3 className="font-bold text-lg mb-2 bg-gray-100 p-2">Proyek: {getProyekName(pId)}</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">Tanggal</th>
                      <th className="py-2 text-left">Plat</th>
                      <th className="py-2 text-left">Grup</th>
                      <th className="py-2 text-right">Vol (m³)</th>
                      <th className="py-2 text-right">Tagihan</th>
                      <th className="py-2 text-right">Biaya</th>
                      <th className="py-2 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map(t => {
                      const tagihan = t.total_harga;
                      const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
                      const potongan = t.potongan_trip || 0;
                      const biaya = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;
                      const margin = tagihan - biaya;
                      subTagihan += tagihan;
                      subBiaya += biaya;
                      subVol += t.volume;
                      return (
                        <tr key={t.id} className="border-b">
                          <td className="py-1">{format(new Date(t.tanggal_bongkar), 'dd/MM/yy')}</td>
                          <td className="py-1">{t.plat_nomor}</td>
                          <td className="py-1">{getGrupName(t.grup_mobil_id)}</td>
                          <td className="py-1 text-right">{t.volume}</td>
                          <td className="py-1 text-right">{formatRp(tagihan)}</td>
                          <td className="py-1 text-right">{formatRp(biaya)}</td>
                          <td className="py-1 text-right">{formatRp(margin)}</td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold border-t">
                      <td colSpan={3} className="py-2 text-right">SUBTOTAL:</td>
                      <td className="py-2 text-right">{subVol}</td>
                      <td className="py-2 text-right">{formatRp(subTagihan)}</td>
                      <td className="py-2 text-right">{formatRp(subBiaya)}</td>
                      <td className="py-2 text-right">{formatRp(subTagihan - subBiaya)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
         })}
      </div>
    </div>
  );
}
