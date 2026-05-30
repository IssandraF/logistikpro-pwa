import { useState, useMemo, Fragment } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const getLokasiName = (plId: number) => {
    const pl = proyekLokasis?.find(x => x.id === plId);
    if (!pl) return '-';
    const loc = lokasiProyeks?.find(x => x.id === pl.lokasi_proyek_id);
    const proj = proyeks?.find(x => x.id === pl.proyek_id);
    return `${proj?.nama_proyek} - ${loc?.nama_lokasi}`;
  };

  const getGrupName = (grupId: number) => {
    return grupMobils?.find(g => g.id === grupId)?.nama_grup || 'Unknown Grup';
  };

  // Filter & Kalkulasi Data
  const { filteredData, summary, summaryPerLokasi } = useMemo(() => {
    if (!completedTrips || !proyeks || !grupMobils || !proyekLokasis) {
      return { filteredData: {}, summary: { volume: 0, tagihan: 0, pembayaran: 0, potonganMat: 0, margin: 0 }, summaryPerLokasi: {} };
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

    // 2. Group by Proyek -> Date & Lokasi
    const grouped: Record<number, Record<string, typeof filtered>> = {};
    let sumVol = 0;
    let sumTagihan = 0;
    let sumPembayaran = 0;
    let sumPotonganMaterial = 0;

    const sumPerLokasi: Record<number, { volume: number; tagihan: number; biaya: number; margin: number }> = {};

    filtered.forEach(t => {
      const pId = getProyekIdByLokasi(t.proyek_lokasi_id);
      const tglBongkar = format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd');
      const plId = t.proyek_lokasi_id;
      const groupKey = `${tglBongkar}|${plId}`;

      if (!grouped[pId]) grouped[pId] = {};
      if (!grouped[pId][groupKey]) grouped[pId][groupKey] = [];
      grouped[pId][groupKey].push(t);

      const tagihan = t.total_harga; // Revenue
      const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
      const potongan = t.potongan_trip || 0;
      const realCost = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;
      const margin = tagihan - realCost;

      // Kalkulasi Global
      sumVol += t.volume;
      sumTagihan += tagihan;
      sumPotonganMaterial += potongan;
      sumPembayaran += realCost;

      // Kalkulasi per Lokasi
      if (!sumPerLokasi[plId]) {
        sumPerLokasi[plId] = { volume: 0, tagihan: 0, biaya: 0, margin: 0 };
      }
      sumPerLokasi[plId].volume += t.volume;
      sumPerLokasi[plId].tagihan += tagihan;
      sumPerLokasi[plId].biaya += realCost;
      sumPerLokasi[plId].margin += margin;
    });

    const sumMargin = sumTagihan - sumPembayaran;

    return { 
      filteredData: grouped, 
      summary: { volume: sumVol, tagihan: sumTagihan, pembayaran: sumPembayaran, potonganMat: sumPotonganMaterial, margin: sumMargin },
      summaryPerLokasi: sumPerLokasi
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
    <div className="p-6 relative" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      
      {/* Header Print (hanya muncul saat diprint) */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Laporan Analisis Margin Trip</h1>
        <p className="text-sm text-gray-600 mt-1">Periode: {startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'Awal'} s/d {endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Akhir'}</p>
        <p className="text-sm text-gray-600">Potongan Material: {includePotonganMaterial ? 'Disertakan (Mengurangi Biaya)' : 'Tidak Disertakan'}</p>
        <div className="border-b-2 border-gray-300 w-full mt-4"></div>
      </div>

      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Cetak Laporan
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Sidebar Filter - Sembunyikan saat print */}
        <Card className="lg:col-span-1 print:hidden h-fit">
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
                    <input 
                      type="checkbox"
                      id={`p-${p.id}`} 
                      checked={selectedProyekIds.includes(p.id!)}
                      onChange={() => toggleProyek(p.id!)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
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
                    <input 
                      type="checkbox"
                      id={`g-${g.id}`} 
                      checked={selectedGrupIds.includes(g.id!)}
                      onChange={() => toggleGrup(g.id!)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor={`g-${g.id}`} className="text-sm font-medium leading-none cursor-pointer">
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
              <label htmlFor="inc-material" className="text-sm font-medium leading-none cursor-pointer">
                Sertakan Potongan Material (Mengurangi Biaya)
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Main Content yang dicetak */}
        <div className="lg:col-span-3 space-y-6 print:col-span-4 w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 break-inside-avoid">
            <Card className="bg-primary/5 print:bg-gray-100 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium print:text-black">Total Volume</p>
                <h3 className="text-2xl font-bold mt-1">{summary.volume.toLocaleString('id-ID')} m³</h3>
              </CardContent>
            </Card>
            <Card className="print:bg-gray-100 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium print:text-black">Total Tagihan (Revenue)</p>
                <div className="flex items-center gap-1 mt-1 text-green-600 print:text-green-700">
                  <ArrowUpRight className="w-5 h-5 print:hidden" />
                  <h3 className="text-xl font-bold">{formatRp(summary.tagihan)}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="print:bg-gray-100 print:border-gray-300">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm text-muted-foreground font-medium print:text-black">Total Pembayaran (Cost)</p>
                <div className="flex items-center gap-1 mt-1 text-red-600 print:text-red-700">
                  <ArrowDownRight className="w-5 h-5 print:hidden" />
                  <h3 className="text-xl font-bold">{formatRp(summary.pembayaran)}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className={summary.margin >= 0 ? "bg-green-600 text-white print:bg-green-600 print:text-white" : "bg-red-600 text-white print:bg-red-600 print:text-white"}>
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-sm opacity-90 font-medium">Margin</p>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-6 h-6 print:hidden" />
                  <h3 className="text-2xl font-bold">{formatRp(summary.margin)}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          {Object.keys(filteredData).length === 0 ? (
            <Card className="print:hidden">
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada data trip yang memenuhi kriteria filter.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tabel Ringkasan per Lokasi */}
              <Card className="break-inside-avoid shadow-md border print:shadow-none">
                <CardHeader className="bg-muted/50 p-4 border-b print:bg-gray-100 print:border-gray-300">
                  <CardTitle className="text-lg">Ringkasan per Lokasi Bongkar</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground print:bg-gray-50 print:text-black">
                        <tr>
                          <th className="p-3 w-10">No</th>
                          <th className="p-3">Lokasi</th>
                          <th className="p-3 text-right">Volume</th>
                          <th className="p-3 text-right">Tagihan</th>
                          <th className="p-3 text-right">Biaya</th>
                          <th className="p-3 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(summaryPerLokasi).map(([plIdStr, sum], idx) => {
                          const isPos = sum.margin >= 0;
                          return (
                            <tr key={plIdStr} className="border-b text-sm print:border-gray-200">
                              <td className="p-3">{idx + 1}</td>
                              <td className="p-3 font-medium">{getLokasiName(Number(plIdStr))}</td>
                              <td className="p-3 text-right">{sum.volume.toLocaleString('id-ID')} m³</td>
                              <td className="p-3 text-right text-green-600 print:text-green-700">{formatRp(sum.tagihan)}</td>
                              <td className="p-3 text-right text-red-600 print:text-red-700">{formatRp(sum.biaya)}</td>
                              <td className={`p-3 text-right font-bold ${isPos ? 'text-green-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`}>
                                {formatRp(sum.margin)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Rincian per Proyek */}
              <div className="space-y-6 pt-4">
                <h2 className="text-xl font-bold print:text-lg">Rincian Trip</h2>
                {Object.entries(filteredData).map(([pIdStr, dateGroups]) => {
                  const pId = Number(pIdStr);
                  
                  // Grand Total for Project
                  let grandTagihan = 0;
                  let grandBiaya = 0;
                  let grandVol = 0;
                  let grandPotongan = 0;

                  return (
                    <Card key={pId} className="overflow-hidden break-inside-avoid shadow-md border print:shadow-none print:border-gray-300">
                      <CardHeader className="bg-muted/50 p-4 border-b print:bg-gray-100 print:border-gray-300">
                        <CardTitle className="text-lg flex justify-between items-center">
                          <span>Proyek: {getProyekName(pId)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-muted/30 border-b text-xs uppercase text-muted-foreground print:bg-gray-50 print:text-black">
                              <tr>
                                <th className="p-3 w-10">No</th>
                                <th className="p-3">Plat Nomor</th>
                                <th className="p-3">Grup Truk</th>
                                <th className="p-3 text-right">Volume</th>
                                {includePotonganMaterial && <th className="p-3 text-right">Ptg Material</th>}
                                <th className="p-3 text-right">Tagihan (Inv)</th>
                                <th className="p-3 text-right">Biaya (Slip)</th>
                                <th className="p-3 text-right">Margin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(dateGroups).map(([key, trips]) => {
                                const [tglStr, plIdStr] = key.split('|');
                                const plId = Number(plIdStr);
                                
                                let subTagihan = 0;
                                let subBiaya = 0;
                                let subVol = 0;
                                let subPotongan = 0;

                                const rows = trips.map((t, idx) => {
                                  const tagihan = t.total_harga;
                                  const costUtuh = t.volume * (t.harga_bayar || t.harga_trip);
                                  const potongan = t.potongan_trip || 0;
                                  const biaya = includePotonganMaterial ? (costUtuh - potongan) : costUtuh;
                                  const margin = tagihan - biaya;
                                  
                                  subTagihan += tagihan;
                                  subBiaya += biaya;
                                  subVol += t.volume;
                                  subPotongan += potongan;

                                  return (
                                    <tr key={t.id} className="border-b hover:bg-muted/30 text-sm print:border-gray-200">
                                      <td className="p-3">{idx + 1}</td>
                                      <td className="p-3 font-medium">{t.plat_nomor}</td>
                                      <td className="p-3">{getGrupName(t.grup_mobil_id)}</td>
                                      <td className="p-3 text-right">{t.volume.toLocaleString('id-ID')} m³</td>
                                      {includePotonganMaterial && <td className="p-3 text-right text-red-500 print:text-red-700">{formatRp(potongan)}</td>}
                                      <td className="p-3 text-right text-green-600 print:text-green-700">{formatRp(tagihan)}</td>
                                      <td className="p-3 text-right text-red-600 print:text-red-700">{formatRp(biaya)}</td>
                                      <td className={`p-3 text-right font-bold ${margin >= 0 ? 'text-green-600 print:text-green-700' : 'text-red-600 print:text-red-700'}`}>
                                        {formatRp(margin)}
                                      </td>
                                    </tr>
                                  );
                                });

                                grandTagihan += subTagihan;
                                grandBiaya += subBiaya;
                                grandVol += subVol;
                                grandPotongan += subPotongan;

                                return (
                                  <Fragment key={key}>
                                    <tr className="bg-muted/20 border-b print:bg-gray-100">
                                      <td colSpan={includePotonganMaterial ? 8 : 7} className="p-3 font-semibold text-primary print:text-black">
                                        Tgl Bongkar: {format(new Date(tglStr), 'dd/MM/yyyy')} | Lokasi: {getLokasiName(plId)}
                                      </td>
                                    </tr>
                                    {rows}
                                    <tr className="bg-primary/5 font-semibold text-sm border-t border-b-2 print:bg-gray-50 print:border-gray-300">
                                      <td colSpan={3} className="p-3 text-right">Subtotal {format(new Date(tglStr), 'dd/MM')}:</td>
                                      <td className="p-3 text-right">{subVol.toLocaleString('id-ID')} m³</td>
                                      {includePotonganMaterial && <td className="p-3 text-right text-red-600 print:text-red-700">{formatRp(subPotongan)}</td>}
                                      <td className="p-3 text-right text-green-700">{formatRp(subTagihan)}</td>
                                      <td className="p-3 text-right text-red-700">{formatRp(subBiaya)}</td>
                                      <td className={`p-3 text-right ${subTagihan - subBiaya >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formatRp(subTagihan - subBiaya)}
                                      </td>
                                    </tr>
                                  </Fragment>
                                );
                              })}
                              
                              {/* Grand Total Proyek */}
                              <tr className="bg-primary/10 font-bold text-sm border-t-2 print:bg-gray-100 print:border-gray-400">
                                <td colSpan={3} className="p-3 text-right">GRAND TOTAL PROYEK:</td>
                                <td className="p-3 text-right">{grandVol.toLocaleString('id-ID')} m³</td>
                                {includePotonganMaterial && <td className="p-3 text-right text-red-700">{formatRp(grandPotongan)}</td>}
                                <td className="p-3 text-right text-green-700">{formatRp(grandTagihan)}</td>
                                <td className="p-3 text-right text-red-700">{formatRp(grandBiaya)}</td>
                                <td className={`p-3 text-right ${grandTagihan - grandBiaya >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {formatRp(grandTagihan - grandBiaya)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
