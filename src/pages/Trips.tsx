import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { compressImage } from '@/lib/image-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';

import { toast } from 'sonner';
import { Download, Printer, Plus, Trash2, CheckSquare, Edit, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import PrintRekapTrips from '@/components/PrintRekapTrips';
import { printWithTitle } from '@/lib/print-utils';

export default function Trips() {
  const [activeTab, setActiveTab] = useState('data');

  const trips = useLiveQuery(() => db.trips.where('isDeleted').equals(0).reverse().sortBy('tanggal_bongkar'));
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.where('isDeleted').equals(0).toArray());
  const kuaris = useLiveQuery(() => db.lokasiKuaris.where('isDeleted').equals(0).toArray());
  const jasas = useLiveQuery(() => db.jenisJasas.where('isDeleted').equals(0).toArray());
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.where('isDeleted').equals(0).toArray());

  // Form State (Single)
  const [grupId, setGrupId] = useState('');
  const [platNomor, setPlatNomor] = useState('');
  const [proyekLokasiId, setProyekLokasiId] = useState('');
  const [kuariId, setKuariId] = useState('');
  const [jasaId, setJasaId] = useState('');
  const [volume, setVolume] = useState('');
  const [hargaTrip, setHargaTrip] = useState('');
  const [tglMuat, setTglMuat] = useState('');
  const [tglBongkar, setTglBongkar] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);

  // Form State (Mass Input)
  const [massTglMuat, setMassTglMuat] = useState('');
  const [massTglBongkar, setMassTglBongkar] = useState('');
  const [massJasaId, setMassJasaId] = useState('');
  const [massProyekLokasiId, setMassProyekLokasiId] = useState('');
  const [massKuariId, setMassKuariId] = useState('');
  const [massHargaTrip, setMassHargaTrip] = useState('');
  
  interface MassRow {
    id: number;
    plat_nomor: string;
    volume: string;
    grup_mobil_id: string;
  }
  const [massRows, setMassRows] = useState<MassRow[]>([{ id: 1, plat_nomor: '', volume: '', grup_mobil_id: '' }]);

  // Filter Print / Excel State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'print' | 'excel'>('print');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterProyekId, setFilterProyekId] = useState('');
  const [showRingkasanKuari, setShowRingkasanKuari] = useState(true);
  const [hargaMaterialMap, setHargaMaterialMap] = useState<Record<number, number>>({});

  // Computations for filtering trips
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    let result = [...trips];
    
    if (filterStart) {
      const start = new Date(filterStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter(t => new Date(t.tanggal_bongkar) >= start);
    }
    
    if (filterEnd) {
      const end = new Date(filterEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.tanggal_bongkar) <= end);
    }

    if (filterProyekId && filterProyekId !== 'all') {
      const allowedProyekLokasiIds = proyekLokasis?.filter(pl => pl.proyek_id === Number(filterProyekId)).map(pl => pl.id) || [];
      result = result.filter(t => allowedProyekLokasiIds.includes(t.proyek_lokasi_id));
    }
    
    return result;
  }, [trips, filterStart, filterEnd, filterProyekId, proyekLokasis]);

  // Unique Kuaris in Filtered Trips
  const uniqueKuaris = useMemo(() => {
    const kuariIds = new Set(filteredTrips.map(t => t.lokasi_kuari_id));
    return Array.from(kuariIds).map(id => kuaris?.find(k => k.id === id)).filter(Boolean) as import('@/lib/db').LokasiKuari[];
  }, [filteredTrips, kuaris]);

  // Handle Photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setPhoto(compressedBase64);
      } catch {
        toast.error('Gagal memproses gambar');
      }
    }
  };

  // Single Input
  const editTrip = (t: import('@/lib/db').Trip) => {
    setEditingTripId(t.id!);
    setGrupId(t.grup_mobil_id.toString());
    setPlatNomor(t.plat_nomor);
    setProyekLokasiId(t.proyek_lokasi_id.toString());
    setKuariId(t.lokasi_kuari_id.toString());
    setJasaId(t.jenis_jasa_id.toString());
    setVolume(t.volume.toString());
    setHargaTrip(t.harga_trip.toString());
    setTglMuat(format(new Date(t.tanggal_muat), 'yyyy-MM-dd'));
    setTglBongkar(format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd'));
    setPhoto(t.bukti_do || null);
    setActiveTab('single');
  };

  const cancelEditTrip = () => {
    setEditingTripId(null);
    setGrupId(''); setPlatNomor(''); setProyekLokasiId(''); setKuariId(''); setJasaId(''); setVolume(''); setHargaTrip(''); setTglMuat(''); setTglBongkar(''); setPhoto(null);
  };

  const syncInvoiceTotals = async (invoiceId: number) => {
    const invTrips = await db.trips.where('invoice_id').equals(invoiceId).filter(t => t.isDeleted === 0).toArray();
    const qPrices = await db.invoiceQuarryPrices.where('invoice_id').equals(invoiceId).toArray();
    
    let vol = 0;
    let kotor = 0;
    const kuariMap: Record<number, number> = {};
    
    invTrips.forEach(t => {
      vol += t.volume;
      kotor += t.total_harga;
      kuariMap[t.lokasi_kuari_id] = (kuariMap[t.lokasi_kuari_id] || 0) + 1;
    });

    let potongan = 0;
    for (const qp of qPrices) {
      const count = kuariMap[qp.lokasi_kuari_id] || 0;
      await db.invoiceQuarryPrices.update(qp.id!, { jumlah_trip: count });
      potongan += count * qp.harga_material_override;
    }

    const bersih = kotor - potongan;

    await db.invoices.update(invoiceId, {
      total_kubikasi: vol,
      total_harga_kotor: kotor,
      total_potongan_material: potongan,
      total_harga_bersih: bersih
    });
  };

  const handleSaveSingle = async () => {
    if (!grupId || !platNomor || !proyekLokasiId || !kuariId || !jasaId || !volume || !hargaTrip || !tglMuat || !tglBongkar) {
      toast.error('Harap isi semua field yang wajib');
      return;
    }
    
    if (editingTripId) {
      const existingTrip = await db.trips.get(editingTripId);

      await db.trips.update(editingTripId, {
        grup_mobil_id: Number(grupId),
        plat_nomor: platNomor.toUpperCase(),
        lokasi_kuari_id: Number(kuariId),
        proyek_lokasi_id: Number(proyekLokasiId),
        jenis_jasa_id: Number(jasaId),
        volume: Number(volume),
        harga_trip: Number(hargaTrip),
        total_harga: Number(volume) * Number(hargaTrip),
        tanggal_muat: new Date(tglMuat),
        tanggal_bongkar: new Date(tglBongkar),
        bukti_do: photo || undefined,
      });

      if (existingTrip?.invoice_id) {
        await syncInvoiceTotals(existingTrip.invoice_id);
      }

      toast.success('Trip berhasil diperbarui');
    } else {
      await db.trips.add({
        grup_mobil_id: Number(grupId),
        plat_nomor: platNomor.toUpperCase(),
        lokasi_kuari_id: Number(kuariId),
        proyek_lokasi_id: Number(proyekLokasiId),
        jenis_jasa_id: Number(jasaId),
        volume: Number(volume),
        harga_trip: Number(hargaTrip),
        total_harga: Number(volume) * Number(hargaTrip),
        tanggal_muat: new Date(tglMuat),
        tanggal_bongkar: new Date(tglBongkar),
        bukti_do: photo || undefined,
        invoice_id: null,
        slip_pembayaran_id: null,
        createdAt: new Date(),
        isDeleted: 0
      });
      toast.success('Trip berhasil ditambahkan');
    }
    
    setActiveTab('data');
    cancelEditTrip();
  };

  // Mass Input Functions
  const addMassRow = () => {
    const lastGrup = massRows.length > 0 ? massRows[massRows.length - 1].grup_mobil_id : '';
    setMassRows([...massRows, { id: Date.now(), plat_nomor: '', volume: '', grup_mobil_id: lastGrup }]);
  };

  const removeMassRow = (id: number) => {
    setMassRows(massRows.filter(r => r.id !== id));
  };

  const handleMassRowChange = async (id: number, field: keyof MassRow, value: string) => {
    const newRows = [...massRows];
    const rowIdx = newRows.findIndex(r => r.id === id);
    if (rowIdx === -1) return;

    if (field === 'plat_nomor') {
      const upValue = value.toUpperCase();
      newRows[rowIdx].plat_nomor = upValue;
      // Magic Auto-Detect Plat
      if (upValue.length >= 4) {
        const lastTrip = await db.trips.where('plat_nomor').equals(upValue).reverse().first();
        if (lastTrip && !newRows[rowIdx].grup_mobil_id) {
          newRows[rowIdx].grup_mobil_id = lastTrip.grup_mobil_id.toString();
          toast.info(`Plat ${upValue} otomatis terdeteksi sebagai grup ${grupMobils?.find(g => g.id === lastTrip.grup_mobil_id)?.nama_grup}`);
        }
      }
    } else {
      newRows[rowIdx][field] = value as never;
    }
    
    setMassRows(newRows);
  };

  const handleSaveMass = async () => {
    if (!massTglMuat || !massTglBongkar || !massJasaId || !massProyekLokasiId || !massKuariId || !massHargaTrip) {
      toast.error('Harap isi semua atribut global di bagian atas.');
      return;
    }

    const invalidRows = massRows.filter(r => !r.plat_nomor || !r.volume || !r.grup_mobil_id);
    if (invalidRows.length > 0) {
      toast.error('Harap lengkapi plat nomor, volume, dan grup pada semua baris.');
      return;
    }

    const hrgTrip = Number(massHargaTrip);
    const tripsToInsert = massRows.map(r => ({
      grup_mobil_id: Number(r.grup_mobil_id),
      plat_nomor: r.plat_nomor.toUpperCase(),
      lokasi_kuari_id: Number(massKuariId),
      proyek_lokasi_id: Number(massProyekLokasiId),
      jenis_jasa_id: Number(massJasaId),
      volume: Number(r.volume),
      harga_trip: hrgTrip,
      total_harga: Number(r.volume) * hrgTrip,
      tanggal_muat: new Date(massTglMuat),
      tanggal_bongkar: new Date(massTglBongkar),
      invoice_id: null,
      slip_pembayaran_id: null,
      createdAt: new Date(),
      isDeleted: 0
    }));

    try {
      await db.trips.bulkAdd(tripsToInsert);
      toast.success(`${tripsToInsert.length} Trip berhasil ditambahkan secara massal!`);
      setActiveTab('data');
      setMassRows([{ id: Date.now(), plat_nomor: '', volume: '', grup_mobil_id: '' }]);
    } catch {
      toast.error('Gagal menyimpan trip massal.');
    }
  };

  const deleteTrip = async (id: number) => {
    const existing = await db.trips.get(id);
    await db.trips.update(id, { isDeleted: 1 });
    if (existing?.invoice_id) {
      await syncInvoiceTotals(existing.invoice_id);
    }
    toast.success('Trip dihapus');
  };

  // Export / Print
  const handleOpenFilter = (type: 'print' | 'excel') => {
    setActionType(type);
    setFilterStart('');
    setFilterEnd('');
    setFilterProyekId('all');
    setShowRingkasanKuari(true);
    setHargaMaterialMap({});
    setPrintModalOpen(true);
  };

  const executeAction = () => {
    setPrintModalOpen(false);
    
    if (filteredTrips.length === 0) {
      toast.error('Tidak ada data trip pada rentang tanggal tersebut.');
      return;
    }

    if (actionType === 'excel') {
      doExportExcel();
    } else {
      setTimeout(() => {
        printWithTitle(`Rekap_Trip_${filterStart ? filterStart : 'All'}`);
      }, 500);
    }
  };

  const doExportExcel = () => {
    const aoa: (string | number)[][] = [];
    aoa.push(['REKAPITULASI TRIP HARIAN LOGISTIKPRO']);
    aoa.push([`DIUNDUH PADA: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`]);
    if (filterStart || filterEnd) {
      aoa.push([`FILTER TANGGAL: ${filterStart || '-'} s/d ${filterEnd || '-'}`]);
    }
    aoa.push([]);
    
    aoa.push(['NO', 'TANGGAL BONGKAR', 'GRUP MOBIL', 'PLAT NOMOR', 'ASAL KUARI', 'VOLUME', 'TOTAL HARGA']);
    
    filteredTrips.forEach((t, idx) => {
      const grup = grupMobils?.find(g => g.id === t.grup_mobil_id)?.nama_grup || '';
      const kuari = kuaris?.find(k => k.id === t.lokasi_kuari_id)?.nama_lokasi || '';
      aoa.push([
        idx + 1,
        format(new Date(t.tanggal_bongkar), 'dd-MM-yyyy'),
        grup,
        t.plat_nomor,
        kuari,
        t.volume,
        t.total_harga
      ]);
    });
    
    const totalVol = filteredTrips.reduce((s, t) => s + t.volume, 0);
    const totalHrg = filteredTrips.reduce((s, t) => s + t.total_harga, 0);
    aoa.push([]);
    aoa.push(['', '', '', '', 'TOTAL KESELURUHAN', totalVol, totalHrg]);

    if (showRingkasanKuari) {
      aoa.push([]);
      aoa.push([]);
      aoa.push(['RINGKASAN TEMPAT MUAT (KUARI)']);
      aoa.push(['ASAL KUARI', 'HARGA MATERIAL/TRIP', 'JUMLAH RIT', 'TOTAL VOLUME', 'TOTAL HARGA MATERIAL']);
      
      const kuariGroups = filteredTrips.reduce((acc, t) => {
        if (!acc[t.lokasi_kuari_id]) acc[t.lokasi_kuari_id] = [];
        acc[t.lokasi_kuari_id].push(t);
        return acc;
      }, {} as Record<number, typeof filteredTrips>);
      
      const hrgMatMap = hargaMaterialMap || {};
      
      Object.entries(kuariGroups).forEach(([kId, items]) => {
        const kIdNum = Number(kId);
        const kName = kuaris?.find(k => k.id === kIdNum)?.nama_lokasi || '-';
        const vol = items.reduce((s, t) => s + t.volume, 0);
        const hrgMat = hrgMatMap[kIdNum] || 0;
        aoa.push([kName, hrgMat, items.length, vol, items.length * hrgMat]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 5 },  { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Trip");
    XLSX.writeFile(wb, `Rekap_Trip_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold">Data Trip Operasional</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList className="mb-4">
          <TabsTrigger value="data">Data Trip</TabsTrigger>
          <TabsTrigger value="single">Input Trip</TabsTrigger>
          <TabsTrigger value="mass">Mass Input</TabsTrigger>
        </TabsList>

        {/* TAB DATA TRIP */}
        <TabsContent value="data">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Riwayat Trip</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenFilter('excel')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenFilter('print')}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Grup & Plat</th>
                      <th className="p-3">Kuari</th>
                      <th className="p-3">Volume</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips?.slice(0, 100).map(t => (
                      <tr key={t.id} className="border-b">
                        <td className="p-3">{format(new Date(t.tanggal_bongkar), 'dd/MM/yyyy')}</td>
                        <td className="p-3 font-medium">
                          {grupMobils?.find(g => g.id === t.grup_mobil_id)?.nama_grup} <br />
                          <span className="text-muted-foreground">{t.plat_nomor}</span>
                        </td>
                        <td className="p-3">{kuaris?.find(k => k.id === t.lokasi_kuari_id)?.nama_lokasi}</td>
                        <td className="p-3">{t.volume}</td>
                        <td className="p-3">
                          {t.invoice_id ? <span className="bg-success/20 text-success px-2 py-1 rounded text-xs">Di-invoice</span> : <span className="bg-warning/20 text-warning px-2 py-1 rounded text-xs">Pending</span>}
                        </td>
                        <td className="p-3 flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => editTrip(t)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Trip ini?')) deleteTrip(t.id!) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                    {trips?.length === 0 && <tr><td colSpan={6} className="p-4 text-center">Belum ada trip</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Menampilkan maksimal 100 trip terakhir. Gunakan export excel untuk melihat keseluruhan.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SINGLE INPUT */}
        <TabsContent value="single">
          <Card>
            <CardHeader><CardTitle>{editingTripId ? 'Edit Trip Operasional' : 'Tambah Trip Baru (Single)'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grup Mobil</Label>
                  <Select value={grupId} onValueChange={setGrupId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Grup" /></SelectTrigger>
                    <SelectContent>{grupMobils?.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.nama_grup}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plat Nomor</Label>
                  <Input value={platNomor} onChange={e => setPlatNomor(e.target.value.toUpperCase())} className="uppercase" placeholder="BE 1234 XX" />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Muat</Label>
                  <Input type="date" value={tglMuat} onChange={e => setTglMuat(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Bongkar</Label>
                  <Input type="date" value={tglBongkar} onChange={e => setTglBongkar(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Kuari Asal</Label>
                  <Select value={kuariId} onValueChange={setKuariId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kuari" /></SelectTrigger>
                    <SelectContent>{kuaris?.map(k => <SelectItem key={k.id} value={k.id!.toString()}>{k.nama_lokasi}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tujuan Proyek</Label>
                  <Select value={proyekLokasiId} onValueChange={setProyekLokasiId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Proyek Rute" /></SelectTrigger>
                    <SelectContent>
                      {proyekLokasis?.map(pl => {
                        const pName = proyeks?.find(p => p.id === pl.proyek_id)?.nama_proyek;
                        const lName = lokasiProyeks?.find(l => l.id === pl.lokasi_proyek_id)?.nama_lokasi;
                        return <SelectItem key={pl.id} value={pl.id!.toString()}>{pName} - {lName}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Jasa</Label>
                  <Select value={jasaId} onValueChange={setJasaId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Jasa" /></SelectTrigger>
                    <SelectContent>{jasas?.map(j => <SelectItem key={j.id} value={j.id!.toString()}>{j.nama_js}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Volume / Tonase</Label>
                  <Input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Harga Jasa per m3 (Tagihan ke Proyek)</Label>
                  <Input type="number" value={hargaTrip} onChange={e => setHargaTrip(e.target.value)} placeholder="15000" />
                </div>
                <div className="space-y-2">
                  <Label>Foto Bukti DO / Timbangan</Label>
                  <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
                  {photo && <img src={photo} alt="Preview" className="h-24 w-24 object-cover rounded mt-2" />}
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <Button onClick={handleSaveSingle} className="flex-1">
                  {editingTripId ? 'Simpan Perubahan' : <><Plus className="w-4 h-4 mr-2" /> Simpan Trip</>}
                </Button>
                {editingTripId && (
                  <Button variant="outline" onClick={() => { cancelEditTrip(); setActiveTab('data'); }}>Batal</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB MASS INPUT */}
        <TabsContent value="mass">
          <Card>
            <CardHeader>
              <CardTitle>Mass Input Trip Cerdas</CardTitle>
              <p className="text-sm text-muted-foreground">Isi atribut global di bawah ini, lalu ketik Plat Nomor pada tabel. Sistem akan mendeteksi Grup Mobil secara otomatis.</p>
            </CardHeader>
            <CardContent>
              {/* Global Attributes */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 bg-muted/30 p-4 rounded-lg border">
                <div className="space-y-2">
                  <Label>Tanggal Muat</Label>
                  <Input type="date" value={massTglMuat} onChange={e => setMassTglMuat(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Bongkar</Label>
                  <Input type="date" value={massTglBongkar} onChange={e => setMassTglBongkar(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tujuan Proyek</Label>
                  <Select value={massProyekLokasiId} onValueChange={setMassProyekLokasiId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Rute" /></SelectTrigger>
                    <SelectContent>
                      {proyekLokasis?.map(pl => {
                        const pName = proyeks?.find(p => p.id === pl.proyek_id)?.nama_proyek;
                        const lName = lokasiProyeks?.find(l => l.id === pl.lokasi_proyek_id)?.nama_lokasi;
                        return <SelectItem key={pl.id} value={pl.id!.toString()}>{pName} - {lName}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kuari Asal</Label>
                  <Select value={massKuariId} onValueChange={setMassKuariId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kuari" /></SelectTrigger>
                    <SelectContent>{kuaris?.map(k => <SelectItem key={k.id} value={k.id!.toString()}>{k.nama_lokasi}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Jasa</Label>
                  <Select value={massJasaId} onValueChange={setMassJasaId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Jasa" /></SelectTrigger>
                    <SelectContent>{jasas?.map(j => <SelectItem key={j.id} value={j.id!.toString()}>{j.nama_js}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Harga per m3 (Tagihan ke Proyek)</Label>
                  <Input type="number" value={massHargaTrip} onChange={e => setMassHargaTrip(e.target.value)} placeholder="Misal: 15000" />
                </div>
              </div>

              {/* Dynamic Rows */}
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 px-2 font-semibold text-sm text-muted-foreground">
                  <div className="col-span-3">Plat Nomor</div>
                  <div className="col-span-3">Volume</div>
                  <div className="col-span-5">Grup Mobil (Otomatis/Manual)</div>
                  <div className="col-span-1 text-center">Hapus</div>
                </div>

                {massRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-card p-3 md:p-0 rounded-lg border md:border-none shadow-sm md:shadow-none">
                    <div className="col-span-3">
                      <Label className="md:hidden text-xs mb-1 block">Plat Nomor</Label>
                      <Input 
                        placeholder="BE 1234 XX" 
                        value={row.plat_nomor} 
                        onChange={e => handleMassRowChange(row.id, 'plat_nomor', e.target.value)} 
                        className="uppercase"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="md:hidden text-xs mb-1 block">Volume</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={row.volume} 
                        onChange={e => handleMassRowChange(row.id, 'volume', e.target.value)} 
                      />
                    </div>
                    <div className="col-span-5">
                      <Label className="md:hidden text-xs mb-1 block">Grup Mobil</Label>
                      <Select value={row.grup_mobil_id} onValueChange={val => handleMassRowChange(row.id, 'grup_mobil_id', val)}>
                        <SelectTrigger><SelectValue placeholder="Pilih Grup" /></SelectTrigger>
                        <SelectContent>
                          {grupMobils?.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.nama_grup}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 text-center md:text-right">
                      {massRows.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeMassRow(row.id)} className="w-full md:w-auto text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-6">
                <Button variant="outline" onClick={addMassRow} className="flex-1 border-dashed border-2">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Baris
                </Button>
                <Button onClick={handleSaveMass} className="flex-1 bg-green-600 hover:bg-green-700">
                  Simpan {massRows.length} Trip
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FILTER MODAL */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kustomisasi {actionType === 'print' ? 'Cetak PDF' : 'Ekspor Excel'}</DialogTitle>
            <DialogDescription>Saring data trip yang akan direkapitulasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mulai Tanggal</Label>
                <Input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sampai Tanggal</Label>
                <Input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label>Pilih Proyek (Opsional)</Label>
              <Select value={filterProyekId} onValueChange={setFilterProyekId}>
                <SelectTrigger><SelectValue placeholder="Semua Proyek" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Proyek</SelectItem>
                  {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 mt-4 cursor-pointer" onClick={() => setShowRingkasanKuari(!showRingkasanKuari)}>
              <div className={`p-1 rounded ${showRingkasanKuari ? 'bg-primary text-primary-foreground' : 'border bg-background text-transparent'}`}>
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="font-medium select-none">Tampilkan Ringkasan Kuari/Material?</span>
            </div>

            {showRingkasanKuari && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 border rounded-lg p-4 bg-muted/20">
                <p className="text-sm font-semibold">Harga Material per Kuari (Opsional)</p>
                {uniqueKuaris.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada trip di rentang tanggal/proyek tersebut.</p>
                ) : (
                  uniqueKuaris.map(k => (
                    <div key={k.id} className="flex flex-col gap-1">
                      <Label className="text-xs">{k.nama_lokasi}</Label>
                      <Input 
                        type="number" 
                        placeholder="Harga/Rit" 
                        value={hargaMaterialMap[k.id!] || ''} 
                        onChange={e => setHargaMaterialMap({...hargaMaterialMap, [k.id!]: Number(e.target.value)})} 
                      />
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground mt-2">Harga ini akan dikalikan dengan Jumlah Ritase di tabel Ringkasan Tempat Muat.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintModalOpen(false)}>Batal</Button>
            <Button onClick={executeAction}>Lanjutkan {actionType === 'print' ? 'Cetak' : 'Unduh'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print-only layout */}
      {filteredTrips && proyeks && lokasiProyeks && proyekLokasis && kuaris && grupMobils && (
        <PrintRekapTrips
          trips={filteredTrips}
          proyeks={proyeks}
          lokasiProyeks={lokasiProyeks}
          proyekLokasis={proyekLokasis}
          lokasiKuaris={kuaris}
          grupMobils={grupMobils}
          showRingkasanKuari={showRingkasanKuari}
          hargaMaterialMap={hargaMaterialMap}
        />
      )}
    </div>
  );
}
