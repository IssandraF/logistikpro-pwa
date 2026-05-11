import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { FileText, Printer, FileDown, HandCoins, Trash2, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PrintSlip from '@/components/PrintSlip';
import { printWithTitle } from '@/lib/print-utils';

export default function Slips() {
  const [activeTab, setActiveTab] = useState('data');

  const slips = useLiveQuery(() => db.slipPembayarans.reverse().toArray());
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const pendingTrips = useLiveQuery(() => db.trips.filter(t => !t.slip_pembayaran_id && t.isDeleted === 0).toArray());
  const pinjamans = useLiveQuery(() => db.pinjamanGrups.toArray());
  const proyeks = useLiveQuery(() => db.proyeks.toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.toArray());
  const kuaris = useLiveQuery(() => db.lokasiKuaris.toArray());

  const [nomorSlip, setNomorSlip] = useState('');
  const [tglSlip, setTglSlip] = useState('');
  const [grupId, setGrupId] = useState('');
  
  // Print State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [slipToPrint, setSlipToPrint] = useState<any>(null);
  const tripsForPrint = useLiveQuery(
    () => slipToPrint ? db.trips.where('slip_pembayaran_id').equals(slipToPrint.id).toArray() : Promise.resolve([]),
    [slipToPrint]
  );
  const printGrupMobil = useLiveQuery(() => slipToPrint ? db.grupMobils.get(slipToPrint.grup_mobil_id) : Promise.resolve(null), [slipToPrint]);
  
  // Group Pricing Overrides
  const [groupPrices, setGroupPrices] = useState<Record<string, number>>({});
  const [groupDeductions, setGroupDeductions] = useState<Record<string, number>>({});
  const [potongKasbon, setPotongKasbon] = useState('0');

  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSlipId, setEditSlipId] = useState<number | null>(null);
  const [editNomor, setEditNomor] = useState('');
  const [editTgl, setEditTgl] = useState('');

  // Kalkulasi Otomatis
  const { filteredTrips, groupedTrips, totalOngkosAwal, totalPotonganMaterial } = useMemo(() => {
    if (!grupId || !pendingTrips) return { filteredTrips: [], groupedTrips: {}, totalOngkosAwal: 0, totalPotonganMaterial: 0 };
    
    const filtered = pendingTrips.filter(t => t.grup_mobil_id === Number(grupId));
    
    const grouped = filtered.reduce((acc, t) => {
      const tglBongkar = t.tanggal_bongkar ? format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd') : 'Belum Bongkar';
      const key = `${tglBongkar}|${t.proyek_lokasi_id}|${t.lokasi_kuari_id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    }, {} as Record<string, typeof filtered>);

    let totalAwal = 0;
    let totalPotongan = 0;

    Object.entries(grouped).forEach(([key, trips]) => {
      const vol = trips.reduce((s, t) => s + t.volume, 0);
      const hrg = groupPrices[key] !== undefined ? groupPrices[key] : trips[0].harga_trip;
      totalAwal += (vol * hrg);

      const potong = groupDeductions[key] || 0;
      totalPotongan += (trips.length * potong);
    });

    return { filteredTrips: filtered, groupedTrips: grouped, totalOngkosAwal: totalAwal, totalPotonganMaterial: totalPotongan };
  }, [grupId, pendingTrips, groupPrices, groupDeductions]);

  const sisaKasbonTerkini = useMemo(() => {
    if (!grupId || !pinjamans) return 0;
    const p = pinjamans.find(x => x.grup_mobil_id === Number(grupId));
    return p ? p.sisa_kasbon : 0;
  }, [grupId, pinjamans]);

  const totalBersih = totalOngkosAwal - totalPotonganMaterial - Number(potongKasbon);

  const getLokasiName = (plId: number) => {
    const pl = proyekLokasis?.find(x => x.id === plId);
    if (!pl) return '-';
    const loc = lokasiProyeks?.find(x => x.id === pl.lokasi_proyek_id);
    const proj = proyeks?.find(x => x.id === pl.proyek_id);
    return `${proj?.nama_proyek} - ${loc?.nama_lokasi}`;
  };

  const getKuariName = (kId: number) => {
    const k = kuaris?.find(x => x.id === kId);
    return k ? k.nama_lokasi : '-';
  };

  const handleCreateSlip = async () => {
    if (!grupId || !nomorSlip || !tglSlip) {
      toast.error('Isi Grup, Nomor, dan Tanggal Slip');
      return;
    }

    if (filteredTrips.length === 0) {
      toast.error('Tidak ada trip pending untuk grup ini');
      return;
    }

    try {
      // 1. Create Slip
      const sisaKasbonSetelahnya = sisaKasbonTerkini - Number(potongKasbon);
      
      const slipId = await db.slipPembayarans.add({
        nomor_slip: nomorSlip,
        tanggal: new Date(tglSlip),
        grup_mobil_id: Number(grupId),
        total_trip_ongkos: totalOngkosAwal,
        potongan_material: totalPotonganMaterial,
        potongan_kasbon: Number(potongKasbon),
        total_bersih_dibayar: totalBersih,
        sisa_kasbon_setelah_bayar: sisaKasbonSetelahnya,
        status: 'draft',
        createdAt: new Date()
      });

      // 2. Update Trips
      const tripIds = filteredTrips.map(t => t.id!);
      await db.trips.where('id').anyOf(tripIds).modify(t => {
        const tglBongkar = t.tanggal_bongkar ? format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd') : 'Belum Bongkar';
        const key = `${tglBongkar}|${t.proyek_lokasi_id}|${t.lokasi_kuari_id}`;
        t.slip_pembayaran_id = Number(slipId);
        t.harga_bayar = groupPrices[key] !== undefined ? groupPrices[key] : t.harga_trip;
      });

      // 3. Handle Kasbon Mutasi
      if (Number(potongKasbon) > 0) {
        await db.kasbonMutasis.add({
          grup_mobil_id: Number(grupId),
          slip_pembayaran_id: Number(slipId),
          jenis: 'potongan',
          nominal: Number(potongKasbon),
          keterangan: `Potongan dari Slip ${nomorSlip}`,
          tanggal: new Date(tglSlip)
        });

        // Update Pinjaman Grup table
        const p = await db.pinjamanGrups.where('grup_mobil_id').equals(Number(grupId)).first();
        if (p) {
          await db.pinjamanGrups.update(p.id!, {
            total_potongan: p.total_potongan + Number(potongKasbon),
            sisa_kasbon: p.sisa_kasbon - Number(potongKasbon)
          });
        }
      }

      // 4. Update Buku Kas Induk
      await db.kas.add({
        jenis: 'keluar',
        nominal: totalBersih,
        keterangan: `Pembayaran Slip ${nomorSlip} - Grup ${grupMobils?.find(g=>g.id===Number(grupId))?.nama_grup}`,
        tanggal: new Date(tglSlip),
        slip_pembayaran_id: Number(slipId)
      });

      toast.success('Slip Pembayaran berhasil dibuat & Buku Kas di-update!');
      setActiveTab('data');
      
      // Reset Form
      setGrupId('');
      setNomorSlip('');
      setTglSlip('');
      setGroupPrices({});
      setGroupDeductions({});
      setPotongKasbon('0');

    } catch {
      toast.error('Gagal membuat slip pembayaran');
    }
  };

  const processBayar = async (slipId: number) => {
    try {
      const slip = slips?.find(s => s.id === slipId);
      if (!slip) return;
      if (slip.status !== 'draft') return toast.error('Hanya slip DRAFT yang bisa diproses');

      await db.slipPembayarans.update(slipId, { status: 'lunas' });
      
      await db.kas.add({
        tanggal: new Date(),
        jenis: 'keluar',
        keterangan: `Pembayaran Slip ${slip.nomor_slip} untuk Vendor ${grupMobils?.find(g => g.id === slip.grup_mobil_id)?.nama_grup}`,
        nominal: slip.total_bersih_dibayar,
        slip_pembayaran_id: slipId
      });

      toast.success('Slip Berhasil Diproses & Dicatat di Buku Kas');
    } catch {
      toast.error('Gagal memproses pembayaran');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteSlip = async (slip: any) => {
    if (confirm(`Yakin HAPUS Slip ${slip.nomor_slip}? Trip akan dikembalikan menjadi pending, kas & mutasi kasbon akan dibatalkan.`)) {
      try {
        await db.transaction('rw', [db.trips, db.kas, db.kasbonMutasis, db.pinjamanGrups, db.slipPembayarans], async () => {
          // 1. Rollback Trips
          const trips = await db.trips.where('slip_pembayaran_id').equals(slip.id).toArray();
          const tripIds = trips.map(t => t.id!);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.trips.where('id').anyOf(tripIds).modify((t: any) => { t.slip_pembayaran_id = null; });

          // 2. Hapus Kas
          await db.kas.where('slip_pembayaran_id').equals(slip.id).delete();

          // 3. Rollback KasbonMutasi (jika ada)
          const mutasis = await db.kasbonMutasis.where('slip_pembayaran_id').equals(slip.id).toArray();
          for (const mutasi of mutasis) {
            const pinjaman = await db.pinjamanGrups.where('grup_mobil_id').equals(mutasi.grup_mobil_id).first();
            if (pinjaman) {
              await db.pinjamanGrups.update(pinjaman.id!, {
                total_potongan: pinjaman.total_potongan - mutasi.nominal,
                sisa_kasbon: pinjaman.sisa_kasbon + mutasi.nominal
              });
            }
          }
          await db.kasbonMutasis.where('slip_pembayaran_id').equals(slip.id).delete();

          // 4. Hapus Slip
          await db.slipPembayarans.delete(slip.id);
        });

        toast.success('Slip dihapus & data terkait di-rollback!');
      } catch (error) {
        toast.error('Gagal menghapus slip: ' + error);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditModal = (slip: any) => {
    setEditSlipId(slip.id);
    setEditNomor(slip.nomor_slip);
    setEditTgl(format(new Date(slip.tanggal), 'yyyy-MM-dd'));
    setEditModalOpen(true);
  };

  const handleUpdateSlip = async () => {
    if (!editSlipId || !editNomor || !editTgl) return toast.error('Nomor dan Tanggal wajib diisi');
    try {
      await db.slipPembayarans.update(editSlipId, {
        nomor_slip: editNomor,
        tanggal: new Date(editTgl)
      });
      toast.success('Slip berhasil diperbarui');
      setEditModalOpen(false);
    } catch {
      toast.error('Gagal memperbarui slip');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportExcelSingle = async (slip: any) => {
    const invTrips = await db.trips.where('slip_pembayaran_id').equals(slip.id).toArray();
    
    const aoa: (string | number)[][] = [];
    const gName = grupMobils?.find(g => g.id === slip.grup_mobil_id)?.nama_grup || 'VENDOR';
    
    aoa.push([`SLIP PEMBAYARAN: ${gName.toUpperCase()}`]);
    aoa.push([`NOMOR SLIP: ${slip.nomor_slip}`]);
    aoa.push([`TANGGAL: ${format(new Date(slip.tanggal), 'dd-MM-yyyy')}`]);
    aoa.push([]); // empty
    const groupedExcelTrips = invTrips.reduce((acc, t) => {
      const key = t.lokasi_kuari_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
      return acc;
    }, {} as Record<number, typeof invTrips>);

    Object.entries(groupedExcelTrips).forEach(([kId, trips]) => {
      const kuariName = getKuariName(Number(kId));
      aoa.push([`LOKASI MUAT: ${kuariName.toUpperCase()}`]);
      aoa.push(['NO', 'TGL BONGKAR', 'PLAT NOMOR', 'VOLUME', 'HARGA/M3', 'TOTAL HARGA']);
      
      let subTotalVol = 0;
      let subTotalHarga = 0;

      trips.forEach((t, idx) => {
        const totalHarga = t.volume * (t.harga_bayar || t.harga_trip);
        subTotalVol += t.volume;
        subTotalHarga += totalHarga;
        aoa.push([
          idx + 1,
          format(new Date(t.tanggal_bongkar), 'dd-MM-yyyy'),
          t.plat_nomor,
          t.volume,
          t.harga_bayar || t.harga_trip,
          totalHarga
        ]);
      });
      
      aoa.push(['', '', 'SUBTOTAL', subTotalVol, '', subTotalHarga]);
      aoa.push([]); // empty line between groups
    });
    
    aoa.push([]);
    aoa.push(['', '', 'TOTAL KOTOR', '', '', slip.total_trip_ongkos]);
    aoa.push(['', '', 'POTONGAN MATERIAL', '', '', -slip.potongan_material]);
    aoa.push(['', '', 'POTONGAN KASBON', '', '', -slip.potongan_kasbon]);
    aoa.push(['', '', 'TOTAL BERSIH (DIBAYARKAN)', '', '', slip.total_bersih_dibayar]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 5 },  // NO
      { wch: 15 }, // TGL BONGKAR
      { wch: 15 }, // PLAT NOMOR
      { wch: 15 }, // VOLUME
      { wch: 15 }, // HARGA
      { wch: 25 }, // TOTAL HARGA
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Slip Pembayaran");
    XLSX.writeFile(wb, `Slip_${slip.nomor_slip.replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePrintClick = (slip: any) => {
    setSlipToPrint(slip);
    setTimeout(() => {
      printWithTitle(`Slip_${slip.grup_mobil_id}_${slip.nomor_slip.replace(/[/\\?%*:|"<>]/g, '_')}`);
    }, 500);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 print:hidden">Slip Pembayaran Vendor</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="data">Data Slip</TabsTrigger>
          <TabsTrigger value="create">Buat Slip Baru</TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <Card>
            <CardHeader><CardTitle>Daftar Slip</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="p-3">Nomor</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Grup Truk</th>
                      <th className="p-3">Potongan</th>
                      <th className="p-3">Total Bersih</th>
                      <th className="p-3">Sisa Kasbon</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slips?.map(s => (
                      <tr key={s.id} className="border-b">
                        <td className="p-3 font-medium">{s.nomor_slip}</td>
                        <td className="p-3">{format(new Date(s.tanggal), 'dd/MM/yyyy')}</td>
                        <td className="p-3">{grupMobils?.find(g => g.id === s.grup_mobil_id)?.nama_grup}</td>
                        <td className="p-3 text-destructive">Rp {(s.potongan_material + s.potongan_kasbon).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-semibold text-primary">Rp {s.total_bersih_dibayar.toLocaleString('id-ID')}</td>
                        <td className="p-3">Rp {s.sisa_kasbon_setelah_bayar?.toLocaleString('id-ID') || '0'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${s.status === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 flex gap-2 flex-wrap">
                          {s.status === 'draft' && (
                            <Button variant="default" size="sm" onClick={() => processBayar(s.id!)}>
                              <HandCoins className="w-4 h-4 mr-1" /> Bayar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => exportExcelSingle(s)}>
                            <FileDown className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePrintClick(s)}>
                            <Printer className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(s)}>
                            <Edit className="w-4 h-4 text-orange-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteSlip(s)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {slips?.length === 0 && <tr><td colSpan={7} className="p-4 text-center">Belum ada slip pembayaran</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader><CardTitle>Buat Slip Penggajian Truk</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grup Truk (Vendor)</Label>
                  <Select value={grupId} onValueChange={setGrupId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Grup Mobil" /></SelectTrigger>
                    <SelectContent>
                      {grupMobils?.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.nama_grup}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nomor Slip</Label>
                  <Input value={nomorSlip} onChange={e => setNomorSlip(e.target.value)} placeholder="SLIP/2026/01" />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input type="date" value={tglSlip} onChange={e => setTglSlip(e.target.value)} />
                </div>
              </div>

              {grupId && Object.keys(groupedTrips).length > 0 && (
                <div className="mt-8 space-y-6">
                  {/* Trip Groups Overrides */}
                  <div className="bg-muted/30 p-4 rounded-lg border">
                    <h3 className="font-semibold mb-2">Penyesuaian Harga Fix & Material per Kelompok Trip</h3>
                    <p className="text-sm text-muted-foreground mb-4">Total trip pending: {filteredTrips.length} Rit. Trip di bawah telah dikelompokkan berdasarkan Asal Kuari dan Lokasi Tujuan.</p>
                    
                    <div className="space-y-4">
                      {Object.entries(groupedTrips).map(([key, groupTrips]) => {
                        const parts = key.split('|');
                        const tglBongkar = parts[0];
                        const plId = Number(parts[1]);
                        const kId = Number(parts[2]);
                        const vol = groupTrips.reduce((s, t) => s + t.volume, 0);
                        const hrg = groupPrices[key] !== undefined ? groupPrices[key] : groupTrips[0].harga_trip;

                        return (
                          <div key={key} className="flex flex-col gap-3 p-4 bg-background border rounded-lg shadow-sm">
                            <div className="flex justify-between items-center border-b pb-2">
                              <div>
                                <p className="font-bold text-sm text-primary">Tujuan: {getLokasiName(plId)}</p>
                                <p className="text-sm font-semibold text-orange-600">Asal Kuari: {getKuariName(kId)}</p>
                                <p className="text-sm font-semibold text-blue-600">Tanggal Bongkar: {tglBongkar !== 'Belum Bongkar' ? format(new Date(tglBongkar), 'dd/MM/yyyy') : tglBongkar}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{groupTrips.length} Rit</p>
                                <p className="text-xs text-muted-foreground">Total Vol: {vol.toLocaleString('id-ID')} m³</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Harga Fix / m³</Label>
                                <Input 
                                  type="number" 
                                  value={hrg}
                                  onChange={e => setGroupPrices(prev => ({...prev, [key]: Number(e.target.value)}))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-destructive">Potongan Material / Rit</Label>
                                <Input 
                                  type="number" 
                                  placeholder="0"
                                  value={groupDeductions[key] || ''}
                                  onChange={e => setGroupDeductions(prev => ({...prev, [key]: Number(e.target.value)}))}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Summary & Deductions */}
                  <div className="bg-primary/5 p-6 rounded-lg border border-primary/20 space-y-4">
                    <h3 className="font-bold text-lg border-b border-primary/20 pb-2">Rincian Kalkulasi Akhir</h3>
                    
                    <div className="space-y-2 mb-4">
                      <p className="font-semibold text-sm">Rincian Ongkos Awal:</p>
                      {Object.entries(groupedTrips).map(([key, groupTrips]) => {
                        const parts = key.split('|');
                        const tglBongkar = parts[0];
                        const tglStr = tglBongkar !== 'Belum Bongkar' ? format(new Date(tglBongkar), 'dd/MM/yyyy') : tglBongkar;
                        const hrg = groupPrices[key] !== undefined ? groupPrices[key] : groupTrips[0].harga_trip;
                        const vol = groupTrips.reduce((s, t) => s + t.volume, 0);
                        return (
                          <div key={key} className="flex justify-between text-sm text-muted-foreground ml-2">
                            <span>- {tglStr} | {getKuariName(groupTrips[0].lokasi_kuari_id)} (Vol: {vol.toLocaleString('id-ID')} m³) x Rp {hrg.toLocaleString('id-ID')}</span>
                            <span>= Rp {(vol * hrg).toLocaleString('id-ID')}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between font-bold mt-2">
                        <span>Total Ongkos Awal:</span>
                        <span>Rp {totalOngkosAwal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 border-t border-primary/20 pt-4">
                      <p className="font-semibold text-sm text-destructive">Rincian Potongan Material:</p>
                      {Object.entries(groupedTrips).map(([key, groupTrips]) => {
                        const parts = key.split('|');
                        const tglBongkar = parts[0];
                        const tglStr = tglBongkar !== 'Belum Bongkar' ? format(new Date(tglBongkar), 'dd/MM/yyyy') : tglBongkar;
                        const ptg = groupDeductions[key] || 0;
                        if (ptg === 0) return null;
                        return (
                          <div key={key} className="flex justify-between text-sm text-muted-foreground ml-2">
                            <span>- {tglStr} | {getKuariName(groupTrips[0].lokasi_kuari_id)} ({groupTrips.length} Rit) x Rp {ptg.toLocaleString('id-ID')}</span>
                            <span className="text-destructive">= Rp {(groupTrips.length * ptg).toLocaleString('id-ID')}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between font-bold mt-2 text-destructive">
                        <span>Total Potongan Material:</span>
                        <span>- Rp {totalPotonganMaterial.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-primary/20">
                      <div className="space-y-2 md:col-start-2">
                        <Label className="text-destructive">
                          Potongan Kasbon (Sisa Hutang: Rp {sisaKasbonTerkini.toLocaleString('id-ID')})
                        </Label>
                        <Input 
                          type="number" 
                          value={potongKasbon} 
                          onChange={e => setPotongKasbon(e.target.value)} 
                          className="border-destructive/50"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-2xl font-bold bg-primary text-primary-foreground p-4 rounded-md mt-4">
                      <span>Total Bersih Dibayar:</span>
                      <span>Rp {totalBersih.toLocaleString('id-ID')}</span>
                    </div>

                    <Button onClick={handleCreateSlip} size="lg" className="w-full mt-4 bg-green-600 hover:bg-green-700">
                      <FileText className="w-5 h-5 mr-2" /> Terbitkan Slip Pembayaran
                    </Button>
                  </div>
                </div>
              )}
              {grupId && filteredTrips.length === 0 && (
                 <p className="text-center text-muted-foreground p-4">Tidak ada trip pending untuk grup ini.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Metadata Slip</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nomor Slip</Label>
              <Input value={editNomor} onChange={e => setEditNomor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Slip</Label>
              <Input type="date" value={editTgl} onChange={e => setEditTgl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateSlip}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Layout */}
      {slipToPrint && tripsForPrint && printGrupMobil && proyekLokasis && lokasiProyeks && (
        <PrintSlip
          slip={slipToPrint}
          trips={tripsForPrint}
          grupMobil={printGrupMobil}
          proyekLokasis={proyekLokasis}
          lokasiProyeks={lokasiProyeks}
        />
      )}
    </div>
  );
}
