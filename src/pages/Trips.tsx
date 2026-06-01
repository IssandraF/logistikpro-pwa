import { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { compressImage } from '@/lib/image-utils';
import { Cropper, ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';

import { toast } from 'sonner';
import { Trash2, FileText, Download, Printer, Plus, DownloadCloud, UploadCloud, Edit, Eye, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import PrintRekapTrips from '@/components/PrintRekapTrips';
import { printWithTitle } from '@/lib/print-utils';
import { exportSmartTrips, importSmartTrips } from '@/lib/sync-utils';

export default function Trips() {
  const [activeTab, setActiveTab] = useState('data');

  const trips = useLiveQuery(() => db.trips.where('isDeleted').equals(0).reverse().sortBy('tanggal_bongkar'));
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.where('isDeleted').equals(0).toArray());
  const kuaris = useLiveQuery(() => db.lokasiKuaris.where('isDeleted').equals(0).toArray());
  const jasas = useLiveQuery(() => db.jenisJasas.where('isDeleted').equals(0).toArray());
  const jenisMaterials = useLiveQuery(() => db.jenisMaterials.where('isDeleted').equals(0).toArray());
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.where('isDeleted').equals(0).toArray());
  const invoices = useLiveQuery(() => db.invoices.toArray());

  // Form State (Single)
  const [grupId, setGrupId] = useState('');
  const [platNomor, setPlatNomor] = useState('');
  const [proyekLokasiId, setProyekLokasiId] = useState('');
  const [kuariId, setKuariId] = useState('');
  const [jasaId, setJasaId] = useState('');
  const [materialId, setMaterialId] = useState('');
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
  const [massMaterialId, setMassMaterialId] = useState('');
  const [massProyekLokasiId, setMassProyekLokasiId] = useState('');
  const [massHargaTrip, setMassHargaTrip] = useState('');
  
  interface MassRow {
    id: number;
    plat_nomor: string;
    volume: string;
    grup_mobil_id: string;
    lokasi_kuari_id: string;
  }
  const [massRows, setMassRows] = useState<MassRow[]>([{ id: 1, plat_nomor: '', volume: '', grup_mobil_id: '', lokasi_kuari_id: '' }]);

  // Filter View State
  const [viewSearch, setViewSearch] = useState('');
  const [viewFilterGrup, setViewFilterGrup] = useState('all');
  const [viewFilterProyek, setViewFilterProyek] = useState('all');
  const [viewFilterTglStart, setViewFilterTglStart] = useState('');
  const [viewFilterTglEnd, setViewFilterTglEnd] = useState('');

  // Selection State
  const [selectedTrips, setSelectedTrips] = useState<number[]>([]);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<{ url: string; trip?: import('@/lib/db').Trip } | null>(null);
  
  // Cropper State
  const cropperRef = useRef<ReactCropperElement>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [editingTripFromTableId, setEditingTripFromTableId] = useState<number | null>(null);
  
  const [invoiceSelectModalOpen, setInvoiceSelectModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  const displayedTrips = useMemo(() => {
    if (!trips) return [];
    let result = [...trips];

    if (viewSearch) {
      const lower = viewSearch.toLowerCase();
      result = result.filter(t => 
        t.plat_nomor.toLowerCase().includes(lower) || 
        (grupMobils?.find(g => g.id === t.grup_mobil_id)?.nama_grup || '').toLowerCase().includes(lower) ||
        (kuaris?.find(k => k.id === t.lokasi_kuari_id)?.nama_lokasi || '').toLowerCase().includes(lower)
      );
    }

    if (viewFilterGrup && viewFilterGrup !== 'all') {
      result = result.filter(t => t.grup_mobil_id.toString() === viewFilterGrup);
    }

    if (viewFilterProyek && viewFilterProyek !== 'all') {
      const allowedPlIds = proyekLokasis?.filter(pl => pl.proyek_id.toString() === viewFilterProyek).map(pl => pl.id) || [];
      result = result.filter(t => allowedPlIds.includes(t.proyek_lokasi_id));
    }

    if (viewFilterTglStart) {
      const start = new Date(viewFilterTglStart);
      start.setHours(0, 0, 0, 0);
      result = result.filter(t => new Date(t.tanggal_bongkar) >= start);
    }

    if (viewFilterTglEnd) {
      const end = new Date(viewFilterTglEnd);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.tanggal_bongkar) <= end);
    }

    return result;
  }, [trips, viewSearch, viewFilterGrup, viewFilterProyek, viewFilterTglStart, viewFilterTglEnd, grupMobils, kuaris, proyekLokasis]);

  // Filter Print / Excel State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewTripsOpen, setPreviewTripsOpen] = useState(false);
  const [actionType, setActionType] = useState<'print' | 'excel' | 'view'>('print');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterProyekId, setFilterProyekId] = useState('');
  const [filterGrupIds, setFilterGrupIds] = useState<number[]>([]);
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
    
    if (filterGrupIds.length > 0) {
      result = result.filter(t => filterGrupIds.includes(t.grup_mobil_id));
    }
    
    return result;
  }, [trips, filterStart, filterEnd, filterProyekId, filterGrupIds, proyekLokasis]);

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
        setImageToCrop(compressedBase64);
        setCropModalOpen(true);
      } catch {
        toast.error('Gagal memproses gambar');
      }
    }
  };

  const handleSaveCrop = async () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      try {
        const croppedImage = cropperRef.current?.cropper.getCroppedCanvas({
          maxWidth: 1200,
          maxHeight: 1200,
          fillColor: '#fff',
        }).toDataURL('image/jpeg', 0.8);
        
        if (editingTripFromTableId) {
          // Save directly to DB if edited from table
          await db.trips.update(editingTripFromTableId, { bukti_do: croppedImage });
          toast.success('Foto trip berhasil diperbarui!');
          setEditingTripFromTableId(null);
        } else {
          // Set to local state for form input
          setPhoto(croppedImage);
        }
        
        setCropModalOpen(false);
      } catch {
        toast.error('Gagal memotong gambar');
      }
    }
  };

  const handleSaveOriginal = async () => {
    if (!imageToCrop) return;
    try {
      if (editingTripFromTableId) {
        await db.trips.update(editingTripFromTableId, { bukti_do: imageToCrop });
        toast.success('Foto trip berhasil diperbarui (tanpa crop)!');
        setEditingTripFromTableId(null);
      } else {
        setPhoto(imageToCrop);
      }
      setCropModalOpen(false);
    } catch {
      toast.error('Gagal menyimpan gambar');
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
    setMaterialId(t.jenis_material_id ? t.jenis_material_id.toString() : '');
    setVolume(t.volume.toString());
    setHargaTrip(t.harga_trip.toString());
    setTglMuat(format(new Date(t.tanggal_muat), 'yyyy-MM-dd'));
    setTglBongkar(format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd'));
    setPhoto(t.bukti_do || null);
    setActiveTab('single');
  };

  const cancelEditTrip = () => {
    setEditingTripId(null);
    setGrupId(''); setPlatNomor(''); setProyekLokasiId(''); setKuariId(''); setJasaId(''); setMaterialId(''); setVolume(''); setHargaTrip(''); setTglMuat(''); setTglBongkar(''); setPhoto(null);
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

  const handleAddToInvoice = async () => {
    if (!selectedInvoiceId) return toast.error('Pilih invoice terlebih dahulu');
    if (selectedTrips.length === 0) return toast.error('Belum ada trip yang dipilih');
    
    const targetInvoiceId = Number(selectedInvoiceId);
    const oldInvoiceIds = new Set<number>();
    
    try {
      toast.info('Menyimpan perubahan...', { duration: 2000 });
      for (const tripId of selectedTrips) {
        const trip = await db.trips.get(tripId);
        if (trip?.invoice_id && trip.invoice_id !== targetInvoiceId) {
          oldInvoiceIds.add(trip.invoice_id);
        }
        await db.trips.update(tripId, { invoice_id: targetInvoiceId });
      }
      
      // Sync Target
      await syncInvoiceTotals(targetInvoiceId);
      
      // Sync Old ones if any
      for (const oldId of oldInvoiceIds) {
        await syncInvoiceTotals(oldId);
      }

      toast.success('Trip berhasil ditambahkan ke Invoice!');
      setSelectedTrips([]);
      setInvoiceSelectModalOpen(false);
      setSelectedInvoiceId('');
    } catch {
      toast.error('Gagal memproses penambahan invoice');
    }
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
        jenis_material_id: materialId ? Number(materialId) : null,
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
        jenis_material_id: materialId ? Number(materialId) : null,
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
    const lastKuari = massRows.length > 0 ? massRows[massRows.length - 1].lokasi_kuari_id : '';
    setMassRows([...massRows, { id: Date.now(), plat_nomor: '', volume: '', grup_mobil_id: lastGrup, lokasi_kuari_id: lastKuari }]);
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
    if (!massTglMuat || !massTglBongkar || !massJasaId || !massProyekLokasiId || !massHargaTrip) {
      toast.error('Harap isi semua atribut global di bagian atas.');
      return;
    }

    const invalidRows = massRows.filter(r => !r.plat_nomor || !r.volume || !r.grup_mobil_id || !r.lokasi_kuari_id);
    if (invalidRows.length > 0) {
      toast.error('Harap lengkapi plat nomor, volume, grup, dan kuari pada semua baris.');
      return;
    }

    const hrgTrip = Number(massHargaTrip);
    const tripsToInsert = massRows.map(r => ({
      grup_mobil_id: Number(r.grup_mobil_id),
      plat_nomor: r.plat_nomor.toUpperCase(),
      lokasi_kuari_id: Number(r.lokasi_kuari_id),
      proyek_lokasi_id: Number(massProyekLokasiId),
      jenis_jasa_id: Number(massJasaId),
      jenis_material_id: massMaterialId ? Number(massMaterialId) : null,
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
      setMassRows([{ id: Date.now(), plat_nomor: '', volume: '', grup_mobil_id: '', lokasi_kuari_id: '' }]);
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

  // Smart Sync
  const handleExportTrips = async (selectedOnly: boolean = false) => {
    try {
      toast.info('Menyiapkan file ekspor...');
      const idsToExport = selectedOnly ? selectedTrips : undefined;
      await exportSmartTrips(idsToExport);
      toast.success('File ekspor berhasil diunduh');
    } catch {
      toast.error('Gagal mengekspor data');
    }
  };

  const handleImportTrips = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Sedang mengimpor data...', { duration: 3000 });
      const { imported, skipped } = await importSmartTrips(file);
      toast.success(`Selesai! ${imported} Trip ditambahkan. ${skipped} Trip dilewati (duplikat).`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengimpor file');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  // Export / Print
  const handleOpenFilter = (type: 'print' | 'excel' | 'view') => {
    setActionType(type);
    setFilterStart('');
    setFilterEnd('');
    setFilterProyekId('all');
    setFilterGrupIds([]);
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
    } else if (actionType === 'view') {
      setPreviewTripsOpen(true);
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
              <div className="flex gap-2 items-center flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleOpenFilter('view')}><Eye className="w-4 h-4 mr-2" /> View</Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenFilter('excel')}><Download className="w-4 h-4 mr-2" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenFilter('print')}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
                <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
                <Button variant="secondary" size="sm" onClick={() => handleExportTrips(false)}><DownloadCloud className="w-4 h-4 mr-2" /> Smart Export (Semua)</Button>
                <input type="file" id="import-trips" className="hidden" accept=".json" onChange={handleImportTrips} title="Import Trips Data" />
                <Label htmlFor="import-trips" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                  <UploadCloud className="w-4 h-4 mr-2" /> Smart Import
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <Input 
                  placeholder="Cari plat, grup, atau kuari..." 
                  value={viewSearch} 
                  onChange={e => setViewSearch(e.target.value)} 
                />
                <Select value={viewFilterGrup} onValueChange={setViewFilterGrup}>
                  <SelectTrigger><SelectValue placeholder="Semua Grup" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Grup</SelectItem>
                    {grupMobils?.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.nama_grup}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={viewFilterProyek} onValueChange={setViewFilterProyek}>
                  <SelectTrigger><SelectValue placeholder="Semua Proyek" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Proyek</SelectItem>
                    {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="date" 
                    value={viewFilterTglStart} 
                    onChange={e => setViewFilterTglStart(e.target.value)} 
                    title="Mulai Tanggal"
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="date" 
                    value={viewFilterTglEnd} 
                    onChange={e => setViewFilterTglEnd(e.target.value)} 
                    title="Sampai Tanggal"
                    className="w-full"
                  />
                </div>
              </div>

              {selectedTrips.length > 0 && (
                <div className="flex items-center gap-4 bg-primary/10 p-3 rounded-lg border border-primary/20 mb-4 animate-in slide-in-from-top-2 flex-wrap">
                  <span className="font-semibold text-primary">{selectedTrips.length} Trip Dipilih</span>
                  <Button size="sm" onClick={() => setInvoiceSelectModalOpen(true)}>Tambahkan ke Invoice</Button>
                  <Button size="sm" variant="secondary" onClick={() => handleExportTrips(true)}>
                    <DownloadCloud className="w-4 h-4 mr-2" /> Export Terpilih
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedTrips([])}>Batal</Button>
                </div>
              )}

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 cursor-pointer accent-primary"
                          checked={displayedTrips?.length > 0 && selectedTrips.length === displayedTrips.length} 
                          onChange={(e) => {
                             if (e.target.checked) setSelectedTrips(displayedTrips!.map(t => t.id!));
                             else setSelectedTrips([]);
                          }} 
                        />
                      </th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Grup & Plat</th>
                      <th className="p-3">Kuari</th>
                      <th className="p-3">Volume</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Foto</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTrips?.slice(0, 100).map(t => (
                      <tr key={t.id} className={`border-b ${selectedTrips.includes(t.id!) ? 'bg-primary/5' : ''}`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer accent-primary"
                            checked={selectedTrips.includes(t.id!)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTrips([...selectedTrips, t.id!]);
                              else setSelectedTrips(selectedTrips.filter(id => id !== t.id!));
                            }}
                          />
                        </td>
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
                        <td className="p-3 text-center">
                          {t.bukti_do ? (
                            <Button variant="ghost" size="icon" onClick={() => setSelectedPhotoForView({ url: t.bukti_do!, trip: t })} title="Lihat Foto DO">
                              <ImageIcon className="w-4 h-4 text-primary" />
                            </Button>
                          ) : '-'}
                        </td>
                        <td className="p-3 flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => editTrip(t)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if(confirm('Hapus Trip ini?')) deleteTrip(t.id!) }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                    {displayedTrips?.length === 0 && <tr><td colSpan={6} className="p-4 text-center">Belum ada trip</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Menampilkan maksimal 100 trip dari total {displayedTrips?.length || 0} data. Gunakan export excel untuk melihat keseluruhan.</p>
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
                  <Label>Jenis Pengiriman (Jasa)</Label>
                  <Select value={jasaId} onValueChange={setJasaId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Pengiriman" /></SelectTrigger>
                    <SelectContent>{jasas?.map(j => <SelectItem key={j.id} value={j.id!.toString()}>{j.nama_js}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Material (Opsional)</Label>
                  <Select value={materialId} onValueChange={setMaterialId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Material" /></SelectTrigger>
                    <SelectContent>
                      {jenisMaterials?.map(m => <SelectItem key={m.id} value={m.id!.toString()}>{m.nama_material}</SelectItem>)}
                    </SelectContent>
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
                  {photo && (
                    <div className="relative inline-block mt-2">
                      <img 
                        src={photo} 
                        alt="Preview" 
                        className="h-24 w-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border border-border shadow-sm" 
                        onClick={() => setSelectedPhotoForView({ url: photo })}
                        title="Klik untuk memperbesar"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full p-0 flex items-center justify-center shadow-md"
                        onClick={(e) => {
                          e.preventDefault();
                          setImageToCrop(photo);
                          setCropModalOpen(true);
                        }}
                        title="Edit Foto"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
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
                  <Label>Jenis Pengiriman (Jasa)</Label>
                  <Select value={massJasaId} onValueChange={setMassJasaId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Pengiriman" /></SelectTrigger>
                    <SelectContent>{jasas?.map(j => <SelectItem key={j.id} value={j.id!.toString()}>{j.nama_js}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jenis Material (Opsional)</Label>
                  <Select value={massMaterialId} onValueChange={setMassMaterialId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Material" /></SelectTrigger>
                    <SelectContent>
                      {jenisMaterials?.map(m => <SelectItem key={m.id} value={m.id!.toString()}>{m.nama_material}</SelectItem>)}
                    </SelectContent>
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
                  <div className="col-span-2">Volume</div>
                  <div className="col-span-3">Kuari Asal</div>
                  <div className="col-span-3">Grup Mobil</div>
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
                    <div className="col-span-2">
                      <Label className="md:hidden text-xs mb-1 block">Volume</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={row.volume} 
                        onChange={e => handleMassRowChange(row.id, 'volume', e.target.value)} 
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="md:hidden text-xs mb-1 block">Kuari Asal</Label>
                      <Select value={row.lokasi_kuari_id} onValueChange={val => handleMassRowChange(row.id, 'lokasi_kuari_id', val)}>
                        <SelectTrigger><SelectValue placeholder="Pilih Kuari" /></SelectTrigger>
                        <SelectContent>
                          {kuaris?.map(k => <SelectItem key={k.id} value={k.id!.toString()}>{k.nama_lokasi}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
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

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Pilih Proyek (Opsional)</Label>
                <Select value={filterProyekId} onValueChange={setFilterProyekId}>
                  <SelectTrigger><SelectValue placeholder="Semua Proyek" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Proyek</SelectItem>
                    {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pilih Grup (Opsional - Multi)</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2 bg-background flex flex-col">
                  {grupMobils?.map(g => (
                    <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="accent-primary cursor-pointer w-4 h-4"
                        checked={filterGrupIds.includes(g.id!)}
                        onChange={(e) => {
                          if (e.target.checked) setFilterGrupIds([...filterGrupIds, g.id!]);
                          else setFilterGrupIds(filterGrupIds.filter(id => id !== g.id!));
                        }}
                      />
                      {g.nama_grup}
                    </label>
                  ))}
                  {(!grupMobils || grupMobils.length === 0) && (
                    <p className="text-xs text-muted-foreground">Tidak ada grup</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 mt-4 cursor-pointer" onClick={() => setShowRingkasanKuari(!showRingkasanKuari)}>
              <div className={`p-1 rounded ${showRingkasanKuari ? 'bg-primary text-primary-foreground' : 'border bg-background text-transparent'}`}>
                <FileText className="w-4 h-4" />
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

      {/* Preview Modal */}
      <Dialog open={previewTripsOpen} onOpenChange={setPreviewTripsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>Preview Rekap Trip</DialogTitle>
          </DialogHeader>
          <div className="bg-gray-100 p-4 rounded-md">
            <PrintRekapTrips
              trips={filteredTrips}
              proyeks={proyeks || []}
              lokasiProyeks={lokasiProyeks || []}
              proyekLokasis={proyekLokasis || []}
              lokasiKuaris={kuaris || []}
              showRingkasanKuari={showRingkasanKuari}
              hargaMaterialMap={hargaMaterialMap}
              previewMode={true}
            />
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setPreviewTripsOpen(false)}>Tutup</Button>
            <Button onClick={() => {
              setPreviewTripsOpen(false);
              setTimeout(() => {
                printWithTitle(`Rekap_Trip_${filterStart ? filterStart : 'All'}`);
              }, 500);
            }}><Printer className="w-4 h-4 mr-2" /> Cetak Sekarang</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INVOICE SELECTION MODAL */}
      <Dialog open={invoiceSelectModalOpen} onOpenChange={setInvoiceSelectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambahkan ke Invoice</DialogTitle>
            <DialogDescription>Pilih invoice untuk {selectedTrips.length} trip yang dipilih.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Pilih Invoice..." /></SelectTrigger>
                <SelectContent>
                  {invoices?.map(inv => (
                    <SelectItem key={inv.id} value={inv.id!.toString()}>{inv.nomor_invoice} - {format(new Date(inv.tanggal_invoice), 'dd/MM/yyyy')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Data tagihan pada invoice akan dihitung ulang secara otomatis setelah penambahan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceSelectModalOpen(false)}>Batal</Button>
            <Button onClick={handleAddToInvoice}>Simpan ke Invoice</Button>
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

      {/* Modal Foto Bukti DO (Desain Grid) */}
      <Dialog open={!!selectedPhotoForView} onOpenChange={(open) => { if (!open) setSelectedPhotoForView(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white gap-0">
          <DialogHeader className="p-4 border-b bg-muted/20">
            <DialogTitle>{selectedPhotoForView?.trip ? 'Foto Bukti Bongkar' : 'Preview Foto DO'}</DialogTitle>
          </DialogHeader>
          <div className="p-5 relative">
            {selectedPhotoForView?.url && (
              <>
                <img 
                  src={selectedPhotoForView.url} 
                  alt="Bukti DO" 
                  className="w-full h-[200px] sm:h-[300px] object-contain rounded-md bg-muted"
                />
                {selectedPhotoForView.trip && (
                  <Button 
                    size="sm" 
                    className="absolute top-7 right-7 shadow-md"
                    onClick={() => {
                      setImageToCrop(selectedPhotoForView.url);
                      setEditingTripFromTableId(selectedPhotoForView.trip!.id!);
                      setSelectedPhotoForView(null);
                      setCropModalOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Foto
                  </Button>
                )}
              </>
            )}
            
            {selectedPhotoForView?.trip && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground mb-1">Plat Nomor</span>
                  <span className="text-sm font-semibold text-foreground">{selectedPhotoForView.trip.plat_nomor}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground mb-1">Volume</span>
                  <span className="text-sm font-semibold text-foreground">{selectedPhotoForView.trip.volume} m&sup3;</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground mb-1">Kuari</span>
                  <span className="text-sm font-semibold text-foreground">
                    {kuaris?.find(k => k.id === selectedPhotoForView.trip?.lokasi_kuari_id)?.nama_lokasi || '-'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground mb-1">Tujuan / Proyek</span>
                  <span className="text-sm font-semibold text-foreground">
                    {(() => {
                      const pl = proyekLokasis?.find(p => p.id === selectedPhotoForView.trip?.proyek_lokasi_id);
                      if (!pl) return '-';
                      const pName = proyeks?.find(p => p.id === pl.proyek_id)?.nama_proyek;
                      const lName = lokasiProyeks?.find(l => l.id === pl.lokasi_proyek_id)?.nama_lokasi;
                      return `${pName || ''} - ${lName || ''}`;
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cropper */}
      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className="max-w-xl h-[85vh] flex flex-col p-4 bg-white">
          <DialogHeader>
            <DialogTitle>Edit Foto DO</DialogTitle>
            <DialogDescription>Bebas sesuaikan potongan gambar (Free Crop) dan putar bila perlu.</DialogDescription>
          </DialogHeader>
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden my-4 min-h-[300px]">
            {imageToCrop && (
              <Cropper
                src={imageToCrop}
                style={{ height: '100%', width: '100%' }}
                initialAspectRatio={NaN}
                guides={true}
                ref={cropperRef}
                viewMode={1}
                dragMode="crop"
                rotatable={true}
                background={false}
              />
            )}
          </div>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => cropperRef.current?.cropper.rotate(-90)}>
              Putar Kiri
            </Button>
            <Button variant="outline" onClick={() => cropperRef.current?.cropper.rotate(90)}>
              Putar Kanan
            </Button>
          </div>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="sm:mr-auto" onClick={() => {
              setCropModalOpen(false);
              setEditingTripFromTableId(null);
            }}>Batal</Button>
            <Button variant="secondary" onClick={handleSaveOriginal}>Simpan Tanpa Crop</Button>
            <Button onClick={handleSaveCrop}>Simpan Hasil Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
