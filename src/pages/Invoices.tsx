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
import { Eye, FileText, Printer, FileDown, CheckSquare, Image as ImageIcon, Trash2, Edit } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import PrintInvoice from '@/components/PrintInvoice';
import PrintDailyInvoice from '@/components/PrintDailyInvoice';
import { printWithTitle } from '@/lib/print-utils';
import { exportInvoiceExcel } from '@/lib/excel-utils';
import { exportSmartInvoices, importSmartInvoices } from '@/lib/sync-utils';

export default function Invoices() {
  const [activeTab, setActiveTab] = useState('data');
  
  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInvId, setEditInvId] = useState<number | null>(null);
  const [editNomor, setEditNomor] = useState('');
  const [editTgl, setEditTgl] = useState('');
  const [editKepada, setEditKepada] = useState('');
  const [editTtd, setEditTtd] = useState('');

  const invoices = useLiveQuery(() => db.invoices.reverse().toArray());
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const jenisJasas = useLiveQuery(() => db.jenisJasas.where('isDeleted').equals(0).toArray());
  const jenisMaterials = useLiveQuery(() => db.jenisMaterials.where('isDeleted').equals(0).toArray());
  const [kategoriInvoice, setKategoriInvoice] = useState<'agen' | 'proyek'>('agen');

  const pendingTripsQuery = useLiveQuery(
    () => db.trips.filter(t => (kategoriInvoice === 'agen' ? !t.invoice_id : !t.invoice_proyek_id) && t.isDeleted === 0).toArray(),
    [kategoriInvoice]
  );
  const editingTripsQuery = useLiveQuery(
    async () => editInvId ? await db.trips.filter(t => (kategoriInvoice === 'agen' ? t.invoice_id === editInvId : t.invoice_proyek_id === editInvId) && t.isDeleted === 0).toArray() : [],
    [editInvId, kategoriInvoice]
  );
  const allAvailableTrips = useMemo(() => {
    return [...(pendingTripsQuery || []), ...(editingTripsQuery || [])];
  }, [pendingTripsQuery, editingTripsQuery]);
  const lokasiKuaris = useLiveQuery(() => db.lokasiKuaris.toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.toArray());
  const owners = useLiveQuery(() => db.owners.where('isDeleted').equals(0).toArray());

  // DT Harian Queries & State
  const dailyContracts = useLiveQuery(() => db.dailyContracts.where('isDeleted').equals(0).toArray());
  const pendingDailyTimesheets = useLiveQuery(() => db.dailyTimesheets.filter(t => !t.invoice_id && t.isDeleted === 0).toArray());
  
  const [dtInvNomor, setDtInvNomor] = useState('');
  const [dtInvTanggal, setDtInvTanggal] = useState('');
  const [dtContractId, setDtContractId] = useState('');
  const [dtFilterMulai, setDtFilterMulai] = useState('');
  const [dtFilterAkhir, setDtFilterAkhir] = useState('');
  const [dtPphAktif, setDtPphAktif] = useState(true);

  const [nomorInvoice, setNomorInvoice] = useState('');
  const [tglInvoice, setTglInvoice] = useState('');
  const [proyekId, setProyekId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [kepadaCustom, setKepadaCustom] = useState('');
  const [namaTtd, setNamaTtd] = useState('');

  // Split Volume & Custom Price / Balance States
  const [volumeDitagihInput, setVolumeDitagihInput] = useState('');
  const [hargaPerKubikInput, setHargaPerKubikInput] = useState('');
  const [totalKotorInput, setTotalKotorInput] = useState('');
  const [sisaVolSebelumnyaInput, setSisaVolSebelumnyaInput] = useState('');

  // Print States
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);
  const [includePhotos, setIncludePhotos] = useState(false);
  const tripsForPrint = useLiveQuery(
    () => invoiceToPrint && invoiceToPrint.tipe_invoice !== 'harian' ? db.trips.filter(t => invoiceToPrint.kategori_invoice === 'proyek' ? t.invoice_proyek_id === invoiceToPrint.id : t.invoice_id === invoiceToPrint.id).toArray() : Promise.resolve([]),
    [invoiceToPrint]
  );
  const timesheetsForPrint = useLiveQuery(
    () => invoiceToPrint && invoiceToPrint.tipe_invoice === 'harian' ? db.dailyTimesheets.where('invoice_id').equals(invoiceToPrint.id).toArray() : Promise.resolve([]),
    [invoiceToPrint]
  );
  
  const [paperSize, setPaperSize] = useState('A4 portrait');
  const [printScale, setPrintScale] = useState(100);
  const [invoiceTemplate, setInvoiceTemplate] = useState<'standard' | 'classic'>('standard');
  const [accentColor, setAccentColor] = useState<string>('#00B0F0');

  // Memoized Daily Invoice Calculations
  const filteredDailyTimesheets = useMemo(() => {
    if (!dtContractId || !pendingDailyTimesheets) return [];
    const cId = Number(dtContractId);
    let list = pendingDailyTimesheets.filter(t => t.daily_contract_id === cId);
    if (dtFilterMulai) {
      const start = new Date(dtFilterMulai);
      list = list.filter(t => new Date(t.tanggal) >= start);
    }
    if (dtFilterAkhir) {
      const end = new Date(dtFilterAkhir);
      end.setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.tanggal) <= end);
    }
    return list;
  }, [dtContractId, pendingDailyTimesheets, dtFilterMulai, dtFilterAkhir]);

  const selectedDailyContract = useMemo(() => {
    return dailyContracts?.find(c => String(c.id) === dtContractId);
  }, [dailyContracts, dtContractId]);

  const dtTotalHari = useMemo(() => {
    return filteredDailyTimesheets.reduce((s, t) => s + (t.jumlah_hari || 1), 0);
  }, [filteredDailyTimesheets]);

  const dtTarifHarian = selectedDailyContract?.tarif_harian || 1600000;
  const dtTotalKotor = dtTotalHari * dtTarifHarian;
  const dtPphPersen = selectedDailyContract?.pph_persen ?? 2;
  const dtTotalPph = dtPphAktif ? (dtTotalKotor * (dtPphPersen / 100)) : 0;
  const dtTotalNett = dtTotalKotor - dtTotalPph;

  const handleCreateDailyInvoice = async () => {
    if (!dtInvNomor || !dtInvTanggal || !dtContractId) {
      return toast.error('Nomor Invoice, Tanggal, dan Pilih Kontrak wajib diisi');
    }
    if (filteredDailyTimesheets.length === 0) {
      return toast.error('Belum ada timesheet harian yang tersedia pada rentang tanggal ini');
    }

    const contract = selectedDailyContract;
    const newInvoice: import('@/lib/db').Invoice = {
      nomor_invoice: dtInvNomor.trim(),
      tanggal_invoice: new Date(dtInvTanggal),
      proyek_id: contract?.proyek_id || 0,
      owner_id: 1,
      total_kubikasi: 0,
      total_harga_kotor: dtTotalKotor,
      is_potong_material: 0,
      total_potongan_material: 0,
      total_harga_bersih: dtTotalNett,
      status: 'draft',
      tipe_invoice: 'harian',
      daily_contract_id: contract?.id,
      pph_persen: dtPphAktif ? dtPphPersen : 0,
      total_pph: dtTotalPph,
      rekening_bank: `${contract?.bank_nama || 'Mandiri'} ${contract?.bank_rekening || '1080030788005'} a.n ${contract?.bank_atas_nama || 'Irma Fitriani Dalimunte'}`,
      kepada_custom: contract?.pihak_kedua_nama,
      nama_ttd: contract?.pihak_pertama_nama,
      createdAt: new Date(),
    };

    const invId = await db.invoices.add(newInvoice);

    for (const ts of filteredDailyTimesheets) {
      await db.dailyTimesheets.update(ts.id!, { invoice_id: invId });
    }

    toast.success('Invoice Penagihan DT Harian berhasil dibuat!');
    setActiveTab('data');
    setDtInvNomor('');
    setDtInvTanggal('');
    setDtContractId('');
    setDtFilterMulai('');
    setDtFilterAkhir('');
  };
  

  // Filter Tanggal Trip
  const [filterMulai, setFilterMulai] = useState('');
  const [filterAkhir, setFilterAkhir] = useState('');
  
  // Trip Selection & Mass Update
  const [selectedTripsForInvoice, setSelectedTripsForInvoice] = useState<number[]>([]);
  const [massUpdateJasaId, setMassUpdateJasaId] = useState('');
  const [massUpdateMaterialId, setMassUpdateMaterialId] = useState('');
  
  // Kuari prices state: { [kuari_id]: harga_potong }
  const [massUpdatePotongan, setMassUpdatePotongan] = useState('');

  // Memoized calculations for selected project
  const { filteredTrips, totalVolume, totalKotor } = useMemo(() => {
    if (!proyekId || !allAvailableTrips || !proyekLokasis) return { filteredTrips: [], totalVolume: 0, totalKotor: 0 };
    
    // Get all ProyekLokasi IDs for the selected Proyek
    const pId = Number(proyekId);
    const validProyekLokasiIds = proyekLokasis.filter(pl => pl.proyek_id === pId).map(pl => pl.id);

    let filtered = allAvailableTrips.filter(t => validProyekLokasiIds.includes(t.proyek_lokasi_id));

    if (filterMulai) {
      const start = new Date(filterMulai);
      filtered = filtered.filter(t => new Date(t.tanggal_bongkar) >= start);
    }
    if (filterAkhir) {
      const end = new Date(filterAkhir);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.tanggal_bongkar) <= end);
    }
    
    const finalTrips = filtered.filter(t => selectedTripsForInvoice.includes(t.id!));
    
    let vol = 0;
    let kotor = 0;

    finalTrips.forEach(t => {
      vol += t.volume;
      kotor += t.total_harga;
    });


    return { filteredTrips: filtered, selectedTripsObjects: finalTrips, totalVolume: vol, totalKotor: kotor };
  }, [proyekId, allAvailableTrips, proyekLokasis, filterAkhir, filterMulai, selectedTripsForInvoice]);

  const totalPotongan = useMemo(() => {
    if (kategoriInvoice === 'proyek') return 0; // Tidak ada potongan UG untuk invoice proyek
    return filteredTrips
      .filter(t => selectedTripsForInvoice.includes(t.id!))
      .reduce((sum, t) => {
        const jasa = jenisJasas?.find(j => j.id === t.jenis_jasa_id);
        const isUg = jasa ? jasa.nama_js.toLowerCase().includes('ug') || jasa.nama_js.toLowerCase().includes('upah gendong') : true;
        if (!isUg) return sum;
        return sum + (t.potongan_material_invoice || 0);
      }, 0);
  }, [filteredTrips, selectedTripsForInvoice, jenisJasas, kategoriInvoice]);

  const volumeDitagihVal = useMemo(() => {
    if (volumeDitagihInput !== '' && !isNaN(Number(volumeDitagihInput))) {
      return Number(volumeDitagihInput);
    }
    return totalVolume;
  }, [volumeDitagihInput, totalVolume]);

  const sisaVolSebelumnyaVal = useMemo(() => {
    return Number(sisaVolSebelumnyaInput) || 0;
  }, [sisaVolSebelumnyaInput]);

  const sisaVolumeVal = useMemo(() => {
    return Math.max(0, totalVolume + sisaVolSebelumnyaVal - volumeDitagihVal);
  }, [totalVolume, sisaVolSebelumnyaVal, volumeDitagihVal]);

  const totalVolumeDitagihkanTotal = useMemo(() => {
    return volumeDitagihVal + sisaVolSebelumnyaVal;
  }, [volumeDitagihVal, sisaVolSebelumnyaVal]);

  const effectiveTotalKotor = useMemo(() => {
    if (totalKotorInput !== '' && !isNaN(Number(totalKotorInput))) {
      return Number(totalKotorInput);
    }
    if (hargaPerKubikInput !== '' && !isNaN(Number(hargaPerKubikInput))) {
      return totalVolumeDitagihkanTotal * Number(hargaPerKubikInput);
    }
    if (totalVolume > 0 && totalVolumeDitagihkanTotal !== totalVolume) {
      return (totalKotor / totalVolume) * totalVolumeDitagihkanTotal;
    }
    return totalKotor;
  }, [totalKotorInput, hargaPerKubikInput, totalVolumeDitagihkanTotal, totalVolume, totalKotor]);

  const effectiveHargaPerKubik = useMemo(() => {
    if (hargaPerKubikInput !== '' && !isNaN(Number(hargaPerKubikInput))) {
      return Number(hargaPerKubikInput);
    }
    if (totalVolumeDitagihkanTotal > 0) {
      return effectiveTotalKotor / totalVolumeDitagihkanTotal;
    }
    return 0;
  }, [hargaPerKubikInput, effectiveTotalKotor, totalVolumeDitagihkanTotal]);

  const effectiveTotalBersih = useMemo(() => {
    return effectiveTotalKotor - totalPotongan;
  }, [effectiveTotalKotor, totalPotongan]);

  const grandTotalKeseluruhan = useMemo(() => {
    return effectiveTotalBersih;
  }, [effectiveTotalBersih]);

  const handleSelectAllTrips = () => {
    if (filteredTrips.length === selectedTripsForInvoice.length) {
      setSelectedTripsForInvoice([]);
    } else {
      setSelectedTripsForInvoice(filteredTrips.map(t => t.id!));
    }
  };

  const toggleTripSelection = (tripId: number) => {
    if (selectedTripsForInvoice.includes(tripId)) {
      setSelectedTripsForInvoice(selectedTripsForInvoice.filter(id => id !== tripId));
    } else {
      setSelectedTripsForInvoice([...selectedTripsForInvoice, tripId]);
    }
  };

  const handleMassUpdateTrips = async () => {
    if (selectedTripsForInvoice.length === 0) return toast.error('Pilih trip terlebih dahulu');
    if (!massUpdateJasaId && !massUpdateMaterialId && !massUpdatePotongan) return toast.error('Pilih setidaknya satu jenis untuk diupdate');

    try {
      const updates: Record<string, number | null> = {};
      if (massUpdateJasaId) updates.jenis_jasa_id = massUpdateJasaId === 'null' ? null : Number(massUpdateJasaId);
      if (massUpdateMaterialId) updates.jenis_material_id = massUpdateMaterialId === 'null' ? null : Number(massUpdateMaterialId);
      if (massUpdatePotongan) updates.potongan_material_invoice = Number(massUpdatePotongan);

      await db.trips.where('id').anyOf(selectedTripsForInvoice).modify(updates);
      toast.success(`${selectedTripsForInvoice.length} Trip berhasil diupdate!`);
    } catch {
      toast.error('Gagal update trip');
    }
  };

  const handleCreateInvoice = async () => {
    if (!proyekId || !nomorInvoice || !tglInvoice || !ownerId) {
      toast.error('Harap isi Perusahaan, Proyek, Nomor Invoice, dan Tanggal Invoice');
      return;
    }

    if (selectedTripsForInvoice.length === 0) {
      toast.error('Tidak ada trip yang dipilih untuk invoice ini');
      return;
    }

    try {
      if (editInvId) {
        await db.invoices.update(editInvId, {
          nomor_invoice: nomorInvoice,
          tanggal_invoice: new Date(tglInvoice),
          proyek_id: Number(proyekId),
          owner_id: Number(ownerId),
          total_kubikasi: totalVolume,
          volume_ditagih: volumeDitagihVal,
          sisa_volume: sisaVolumeVal,
          sisa_volume_sebelumnya: sisaVolSebelumnyaVal,
          harga_per_kubik: effectiveHargaPerKubik,
          is_custom_total: totalKotorInput !== '' || hargaPerKubikInput !== '',
          total_harga_kotor: effectiveTotalKotor,
          is_potong_material: totalPotongan > 0 ? 1 : 0,
          total_potongan_material: totalPotongan,
          total_harga_bersih: effectiveTotalBersih,
          total_keseluruhan: grandTotalKeseluruhan,
          kategori_invoice: kategoriInvoice,
          kepada_custom: kepadaCustom || undefined,
          nama_ttd: namaTtd || undefined,
        });
        
        // Remove old trips
        const oldTrips = editingTripsQuery || [];
        const oldIds = oldTrips.map(t => t.id!);
        const unselected = oldIds.filter(id => !selectedTripsForInvoice.includes(id));
        if (unselected.length > 0) {
          if (kategoriInvoice === 'agen') {
            await db.trips.where('id').anyOf(unselected).modify({ invoice_id: null });
          } else {
            await db.trips.where('id').anyOf(unselected).modify({ invoice_proyek_id: null });
          }
        }
        // Update newly selected
        if (kategoriInvoice === 'agen') {
          await db.trips.where('id').anyOf(selectedTripsForInvoice).modify({ invoice_id: editInvId });
        } else {
          await db.trips.where('id').anyOf(selectedTripsForInvoice).modify({ invoice_proyek_id: editInvId });
        }

        toast.success('Invoice berhasil diupdate!');
      } else {
        // 1. Create Invoice
        const invoiceId = await db.invoices.add({
          nomor_invoice: nomorInvoice,
          tanggal_invoice: new Date(tglInvoice),
          proyek_id: Number(proyekId),
          owner_id: Number(ownerId),
          total_kubikasi: totalVolume,
          volume_ditagih: volumeDitagihVal,
          sisa_volume: sisaVolumeVal,
          sisa_volume_sebelumnya: sisaVolSebelumnyaVal,
          harga_per_kubik: effectiveHargaPerKubik,
          is_custom_total: totalKotorInput !== '' || hargaPerKubikInput !== '',
          total_harga_kotor: effectiveTotalKotor,
          is_potong_material: totalPotongan > 0 ? 1 : 0,
          total_potongan_material: totalPotongan,
          total_harga_bersih: effectiveTotalBersih,
          total_keseluruhan: grandTotalKeseluruhan,
          kategori_invoice: kategoriInvoice,
          kepada_custom: kepadaCustom || undefined,
          nama_ttd: namaTtd || undefined,
          status: 'draft',
          createdAt: new Date()
        });

        // 2. Update Trips
        if (kategoriInvoice === 'agen') {
          await db.trips.where('id').anyOf(selectedTripsForInvoice).modify({ invoice_id: Number(invoiceId) });
        } else {
          await db.trips.where('id').anyOf(selectedTripsForInvoice).modify({ invoice_proyek_id: Number(invoiceId) });
        }

        toast.success('Invoice berhasil dibuat!');
      }

      setActiveTab('data');
      
      // Reset Form
      setProyekId('');
      setNomorInvoice('');
      setTglInvoice('');
      setMassUpdatePotongan('');
      setKepadaCustom('');
      setFilterMulai('');
      setFilterAkhir('');
      setVolumeDitagihInput('');
      setSisaVolSebelumnyaInput('');
      setHargaPerKubikInput('');
      setTotalKotorInput('');
      setSelectedTripsForInvoice([]);
      setEditInvId(null);
    } catch {
      toast.error('Gagal menyimpan invoice');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportExcelSingle = async (inv: any) => {
    const invTrips = await db.trips.filter(t => inv.kategori_invoice === 'proyek' ? t.invoice_proyek_id === inv.id : t.invoice_id === inv.id).toArray();
    const owner = owners?.find(o => o.id === inv.owner_id);
    const proyek = proyeks?.find(p => p.id === inv.proyek_id);
    
    if (!owner || !proyek || !proyekLokasis || !lokasiProyeks || !lokasiKuaris) {
      toast.error('Data referensi belum lengkap untuk export');
      return;
    }

    await exportInvoiceExcel(
      inv,
      invTrips,
      owner,
      proyek,
      proyekLokasis,
      lokasiProyeks,
      lokasiKuaris
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteInvoice = async (inv: any) => {
    if (confirm(`Yakin HAPUS Invoice ${inv.nomor_invoice}? Seluruh item di dalamnya akan kembali menjadi PENDING.`)) {
      try {
        if (inv.tipe_invoice === 'harian') {
          const timesheets = await db.dailyTimesheets.where('invoice_id').equals(inv.id).toArray();
          for (const ts of timesheets) {
            await db.dailyTimesheets.update(ts.id!, { invoice_id: null });
          }
        } else {
          const trips = await db.trips.filter(t => t.invoice_id === inv.id || t.invoice_proyek_id === inv.id).toArray();
          const tripIds = trips.map(t => t.id!);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.trips.where('id').anyOf(tripIds).modify((t: any) => { 
            if (inv.kategori_invoice === 'proyek') {
              t.invoice_proyek_id = null;
            } else {
              t.invoice_id = null; 
            }
          });
          await db.invoiceQuarryPrices.where('invoice_id').equals(inv.id).delete();
        }
        await db.invoices.delete(inv.id);

        toast.success('Invoice dihapus & Data di-rollback!');
      } catch {
        toast.error('Gagal menghapus invoice');
      }
    }
  };

  const handleEditInvoiceFull = async (inv: any) => {
    setEditInvId(inv.id);
    setProyekId(inv.proyek_id.toString());
    setOwnerId(inv.owner_id.toString());
    setNomorInvoice(inv.nomor_invoice);
    setTglInvoice(format(new Date(inv.tanggal_invoice), 'yyyy-MM-dd'));
    setKepadaCustom(inv.kepada_custom || '');
    setNamaTtd(inv.nama_ttd || '');
    setVolumeDitagihInput(inv.volume_ditagih !== undefined ? inv.volume_ditagih.toString() : '');
    setSisaVolSebelumnyaInput(inv.sisa_volume_sebelumnya !== undefined ? inv.sisa_volume_sebelumnya.toString() : '');
    setHargaPerKubikInput(inv.harga_per_kubik !== undefined ? inv.harga_per_kubik.toString() : '');
    setTotalKotorInput(inv.is_custom_total ? inv.total_harga_kotor.toString() : '');
    setKategoriInvoice(inv.kategori_invoice || 'agen');
    
    const invTrips = await db.trips.filter(t => (inv.kategori_invoice === 'proyek' ? t.invoice_proyek_id === inv.id : t.invoice_id === inv.id) && t.isDeleted === 0).toArray();
    setSelectedTripsForInvoice(invTrips.map(t => t.id!));
    
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditInvId(null);
    setProyekId('');
    setOwnerId('');
    setNomorInvoice('');
    setTglInvoice('');
    setKepadaCustom('');
    setNamaTtd('');
    setVolumeDitagihInput('');
    setSisaVolSebelumnyaInput('');
    setHargaPerKubikInput('');
    setTotalKotorInput('');
    setSelectedTripsForInvoice([]);
    setActiveTab('data');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePreviewClick = (inv: any) => {
    setInvoiceToPrint(inv);
    setIncludePhotos(true);
    setInvoiceTemplate(inv.kategori_invoice === 'proyek' ? 'classic' : 'standard');
    setPreviewModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePrintClick = (inv: any) => {
    setInvoiceToPrint(inv);
    setIncludePhotos(false);
    setInvoiceTemplate(inv.kategori_invoice === 'proyek' ? 'classic' : 'standard');
    setPrintModalOpen(true);
  };

  const executePrint = () => {
    if (!invoiceToPrint || !tripsForPrint) return;
    setPrintModalOpen(false);
    // Tunggu DOM render komponen hidden
    setTimeout(() => {
      printWithTitle(`Invoice_${invoiceToPrint.nomor_invoice.replace(/[/\\?%*:|"<>]/g, '_')}`);
    }, 500);
  };

  // Smart Sync
  const handleExportInvoices = async () => {
    try {
      toast.info('Menyiapkan file ekspor...');
      await exportSmartInvoices();
      toast.success('File ekspor berhasil diunduh');
    } catch {
      toast.error('Gagal mengekspor data');
    }
  };

  const handleImportInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info('Sedang mengimpor data invoice...', { duration: 3000 });
      const { imported, skipped } = await importSmartInvoices(file);
      toast.success(`Selesai! ${imported} Invoice ditambahkan. ${skipped} Invoice dilewati (duplikat).`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengimpor file');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  const selectedOwner = useLiveQuery(() => invoiceToPrint ? db.owners.get(invoiceToPrint.owner_id) : Promise.resolve(null), [invoiceToPrint]);
  const selectedProyek = useLiveQuery(() => invoiceToPrint ? db.proyeks.get(invoiceToPrint.proyek_id) : Promise.resolve(null), [invoiceToPrint]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold">Tagihan (Invoice)</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="data">Data Invoice</TabsTrigger>
          <TabsTrigger value="create">{editInvId ? 'Edit Invoice' : 'Buat Invoice Ritase'}</TabsTrigger>
          <TabsTrigger value="create-daily">Buat Invoice DT Harian</TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Daftar Invoice</CardTitle>
              <div className="flex gap-2 items-center flex-wrap">
                <Button variant="secondary" size="sm" onClick={handleExportInvoices}><FileDown className="w-4 h-4 mr-2" /> Smart Export</Button>
                <input type="file" id="import-invoices" className="hidden" accept=".json" onChange={handleImportInvoices} title="Import Invoices Data" />
                <Label htmlFor="import-invoices" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                  <FileDown className="w-4 h-4 mr-2 rotate-180" /> Smart Import
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="p-3">Nomor</th>
                      <th className="p-3">Tipe</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Proyek</th>
                      <th className="p-3">Volume / Tipe</th>
                      <th className="p-3">Harga Bersih</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices?.map(inv => (
                      <tr key={inv.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-bold">{inv.nomor_invoice}</td>
                        <td className="p-3">
                          {inv.tipe_invoice === 'harian' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold">DT Harian</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">Ritase</span>
                          )}
                        </td>
                        <td className="p-3">{format(new Date(inv.tanggal_invoice), 'dd/MM/yyyy')}</td>
                        <td className="p-3 font-medium">{proyeks?.find(p => p.id === inv.proyek_id)?.nama_proyek || 'Proyek'}</td>
                        <td className="p-3">
                          {inv.tipe_invoice === 'harian' ? (
                            <span className="text-xs text-muted-foreground">Sewa Harian</span>
                          ) : (
                            <span>{inv.total_kubikasi} m³</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">Rp {inv.total_harga_bersih.toLocaleString('id-ID')}</td>
                        <td className="p-3 flex gap-1.5">
                          {inv.tipe_invoice !== 'harian' && (
                            <Button variant="outline" size="sm" onClick={() => exportExcelSingle(inv)}>
                              <FileDown className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handlePreviewClick(inv)}>
                            <Eye className="w-4 h-4 text-purple-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePrintClick(inv)}>
                            <Printer className="w-4 h-4 text-blue-600" />
                          </Button>
                          {inv.tipe_invoice !== 'harian' && (
                            <Button variant="outline" size="sm" onClick={() => handleEditInvoiceFull(inv)}>
                              <Edit className="w-4 h-4 text-orange-600" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleDeleteInvoice(inv)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {invoices?.length === 0 && <tr><td colSpan={7} className="p-4 text-center">Belum ada invoice</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader><CardTitle>Form Invoice Baru</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Kategori Penagihan</Label>
                  <Select value={kategoriInvoice} onValueChange={(v: any) => setKategoriInvoice(v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agen">Internal / Agen (Template 1)</SelectItem>
                      <SelectItem value="proyek">Eksternal / Proyek (Template 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Perusahaan Pengirim (Owner)</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Perusahaan" /></SelectTrigger>
                    <SelectContent>
                      {owners?.map(o => <SelectItem key={o.id} value={o.id!.toString()}>{o.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Proyek Tujuan</Label>
                  <Select value={proyekId} onValueChange={setProyekId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Proyek" /></SelectTrigger>
                    <SelectContent>
                      {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Filter Trip Mulai (Opsional)</Label>
                  <Input type="date" value={filterMulai} onChange={e => setFilterMulai(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Filter Trip Sampai (Opsional)</Label>
                  <Input type="date" value={filterAkhir} onChange={e => setFilterAkhir(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Invoice</Label>
                  <Input value={nomorInvoice} onChange={e => setNomorInvoice(e.target.value)} placeholder="INV/2026/01" />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Invoice</Label>
                  <Input type="date" value={tglInvoice} onChange={e => setTglInvoice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Kepada (Custom, Opsional)</Label>
                  <Input value={kepadaCustom} onChange={e => setKepadaCustom(e.target.value)} placeholder="Tulis nama perusahaan tujuan (jika berbeda dari proyek)..." />
                </div>
                <div className="space-y-2">
                  <Label>Penanda Tangan (Opsional)</Label>
                  <Input value={namaTtd} onChange={e => setNamaTtd(e.target.value)} placeholder="Misal: Bapak Budi" />
                </div>
               </div>

               {proyekId && (
                 <div className="space-y-4">
                   <div className="p-4 bg-muted/50 rounded-md border">
                     <h3 className="font-semibold mb-4 text-lg">Trip Tersedia untuk Di-Invoice</h3>
                     
                     {selectedTripsForInvoice.length > 0 && (
                       <div className="flex flex-col md:flex-row items-end gap-4 p-3 bg-primary/5 rounded border border-primary/20 mb-4 animate-in fade-in">
                         <div className="space-y-2 flex-1">
                           <Label>Ubah Massal Jenis Jasa (Opsional)</Label>
                           <Select value={massUpdateJasaId} onValueChange={setMassUpdateJasaId}>
                             <SelectTrigger><SelectValue placeholder="Biarkan / Pilih Jasa" /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="null">-- Kosongkan Jasa --</SelectItem>
                               {jenisJasas?.map(j => <SelectItem key={j.id} value={j.id!.toString()}>{j.nama_js}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2 flex-1">
                           <Label>Ubah Massal Jenis Material (Opsional)</Label>
                           <Select value={massUpdateMaterialId} onValueChange={setMassUpdateMaterialId}>
                             <SelectTrigger><SelectValue placeholder="Biarkan / Pilih Material" /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="null">-- Kosongkan Material --</SelectItem>
                               {jenisMaterials?.map(m => <SelectItem key={m.id} value={m.id!.toString()}>{m.nama_material}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2 flex-1">
                           <Label>Potongan Material (Rp) (Opsional)</Label>
                           <Input 
                             type="number" 
                             placeholder="Nominal potongan per trip terpilih" 
                             value={massUpdatePotongan} 
                             onChange={e => setMassUpdatePotongan(e.target.value)} 
                           />
                         </div>
                         <Button variant="secondary" onClick={handleMassUpdateTrips}>Terapkan</Button>
                       </div>
                     )}

                     <div className="overflow-x-auto border rounded bg-background max-h-[400px] overflow-y-auto">
                       <table className="w-full text-sm text-left">
                         <thead className="bg-muted sticky top-0 border-b">
                           <tr>
                             <th className="p-3 w-12 text-center">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 cursor-pointer accent-primary"
                                 checked={filteredTrips.length > 0 && selectedTripsForInvoice.length === filteredTrips.length} 
                                 onChange={handleSelectAllTrips} 
                               />
                             </th>
                             <th className="p-3">Tgl Bongkar</th>
                             <th className="p-3">Plat Nomor</th>
                             <th className="p-3">Jenis Jasa</th>
                             <th className="p-3">Jenis Material</th>
                             <th className="p-3 text-right">Volume</th>
                             <th className="p-3 text-right">Potongan (Rp)</th>
                             <th className="p-3 text-right">Harga Total</th>
                           </tr>
                         </thead>
                         <tbody>
                           {filteredTrips.map(t => (
                             <tr key={t.id} className={`border-b ${selectedTripsForInvoice.includes(t.id!) ? 'bg-primary/5' : ''}`}>
                               <td className="p-3 text-center">
                                 <input 
                                   type="checkbox" 
                                   className="w-4 h-4 cursor-pointer accent-primary"
                                   checked={selectedTripsForInvoice.includes(t.id!)}
                                   onChange={() => toggleTripSelection(t.id!)}
                                 />
                               </td>
                               <td className="p-3">{format(new Date(t.tanggal_bongkar), 'dd/MM/yyyy')}</td>
                               <td className="p-3 font-medium">{t.plat_nomor}</td>
                               <td className="p-3">{jenisJasas?.find(j => j.id === t.jenis_jasa_id)?.nama_js}</td>
                               <td className="p-3">{t.jenis_material_id ? jenisMaterials?.find(m => m.id === t.jenis_material_id)?.nama_material : '-'}</td>
                               <td className="p-3 text-right">{t.volume}</td>
                               <td className="p-3 text-right text-red-500">{t.potongan_material_invoice ? `- Rp ${t.potongan_material_invoice.toLocaleString('id-ID')}` : '-'}</td>
                               <td className="p-3 text-right">{(t.total_harga).toLocaleString('id-ID')}</td>
                             </tr>
                           ))}
                           {filteredTrips.length === 0 && <tr><td colSpan={7} className="p-4 text-center">Tidak ada trip pending.</td></tr>}
                         </tbody>
                       </table>
                     </div>
                   </div>
                  <div className="p-4 bg-muted/50 rounded-md border space-y-4">
                    <h3 className="font-semibold text-lg">Rincian & Custom Tagihan Invoice</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Volume Pengiriman Saat Ini */}
                      <div className="p-4 bg-background border rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Pengiriman Terpilih ({selectedTripsForInvoice.length} Rit)</span>
                          <span className="font-bold text-base">{totalVolume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} M³</span>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Volume Ditagihkan dari Pengiriman Ini (M³)</Label>
                          <Input 
                            type="number"
                            placeholder={totalVolume.toString()}
                            value={volumeDitagihInput}
                            onChange={e => setVolumeDitagihInput(e.target.value)}
                          />
                          {sisaVolumeVal > 0 && (
                            <p className="text-xs text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200">
                              ⚠️ Sisa Volume untuk Inv Selanjutnya: <strong>{sisaVolumeVal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} M³</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Sisa Volume Sebelumnya */}
                      <div className="p-4 bg-background border rounded-lg space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-primary">+ Sisa Volume Inv Sebelumnya (M³)</Label>
                          <Input 
                            type="number"
                            placeholder="0 (Misal: 150 M³ dari inv sebelumnya)"
                            value={sisaVolSebelumnyaInput}
                            onChange={e => setSisaVolSebelumnyaInput(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Inputkan sisa volume (M³) dari invoice sebelumnya yang dimasukkan untuk ditagihkan pada invoice ini.
                          </p>
                        </div>
                        {sisaVolSebelumnyaVal > 0 && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-blue-800 text-xs rounded font-semibold flex justify-between">
                            <span>TOTAL VOL DITAGIHKAN INVOICE INI:</span>
                            <span>{totalVolumeDitagihkanTotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} M³</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Deductions Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pricing Section */}
                      <div className="p-4 bg-background border rounded-lg space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Manual Harga per Kubik (Rp / M³)</Label>
                          <Input 
                            type="number"
                            placeholder={`Default: Rp ${(totalVolumeDitagihkanTotal > 0 ? Math.round(totalKotor / totalVolume || 0) : 0).toLocaleString('id-ID')}`}
                            value={hargaPerKubikInput}
                            onChange={e => {
                              setHargaPerKubikInput(e.target.value);
                              setTotalKotorInput('');
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Atau Edit Total Harga Kotor Direct (Rp)</Label>
                          <Input 
                            type="number"
                            placeholder={`Default: Rp ${totalKotor.toLocaleString('id-ID')}`}
                            value={totalKotorInput}
                            onChange={e => {
                              setTotalKotorInput(e.target.value);
                              setHargaPerKubikInput('');
                            }}
                          />
                        </div>
                      </div>

                      {/* Deductions Section */}
                      <div className="p-4 bg-background border rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Potongan Material (UG Only)</span>
                          <span className="text-red-500 font-bold">- Rp {totalPotongan.toLocaleString('id-ID')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          * Potongan material hanya dihitung untuk trip dengan jenis jasa <strong>UG (Upah Gendong)</strong>. Jasa <strong>INCLUDE</strong> bernilai Rp 0 potongan.
                        </p>
                      </div>
                    </div>

                    {/* Financial Summary Card */}
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Total Volume Ditagihkan Keseluruhan:</span>
                        <span className="font-bold">{totalVolumeDitagihkanTotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} M³</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Subtotal (Harga Kotor Invoice Ini):</span>
                        <span className="font-semibold">Rp {effectiveTotalKotor.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Potongan Material:</span>
                        <span className="font-semibold">- Rp {totalPotongan.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-extrabold text-primary pt-2 border-t-2 border-primary/30">
                        <span>TOTAL TAGIHAN BERSIH (GRAND TOTAL):</span>
                        <span>Rp {grandTotalKeseluruhan.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    {editInvId && (
                      <div className="bg-amber-100 text-amber-900 p-3 rounded text-sm">
                        Sedang mengedit Invoice: <strong>{nomorInvoice}</strong>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      {editInvId && (
                        <Button variant="outline" onClick={handleCancelEdit}>Batal Edit</Button>
                      )}
                      <Button onClick={handleCreateInvoice} className="w-full md:w-auto" size="lg">
                        <FileText className="w-4 h-4 mr-2" /> {editInvId ? 'Update Invoice' : 'Simpan Invoice Final'}
                      </Button>
                    </div>
                  </div>
                 </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-daily">
          <Card>
            <CardHeader><CardTitle>Pembuatan Invoice Penagihan DT Harian</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nomor Invoice *</Label>
                  <Input 
                    value={dtInvNomor} 
                    onChange={e => setDtInvNomor(e.target.value)} 
                    placeholder="INV/DT/2026/07/001" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Invoice *</Label>
                  <Input 
                    type="date" 
                    value={dtInvTanggal} 
                    onChange={e => setDtInvTanggal(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pilih Kontrak DT Harian *</Label>
                  <Select value={dtContractId} onValueChange={setDtContractId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kontrak DT" /></SelectTrigger>
                    <SelectContent>
                      {dailyContracts?.map(c => {
                        const pr = proyeks?.find(p => p.id === c.proyek_id);
                        return (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nomor_kontrak} - {pr?.nama_proyek || 'Proyek'} ({c.pihak_kedua_nama})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mulai Tanggal (Filter Timesheet)</Label>
                  <Input 
                    type="date" 
                    value={dtFilterMulai} 
                    onChange={e => setDtFilterMulai(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sampai Tanggal (Filter Timesheet)</Label>
                  <Input 
                    type="date" 
                    value={dtFilterAkhir} 
                    onChange={e => setDtFilterAkhir(e.target.value)} 
                  />
                </div>
                <div className="space-y-2 flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                    <input 
                      type="checkbox" 
                      checked={dtPphAktif} 
                      onChange={e => setDtPphAktif(e.target.checked)} 
                      className="accent-primary w-4 h-4"
                    />
                    Potong PPh 2% (Pasal 23)
                  </label>
                </div>
              </div>

              {selectedDailyContract && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-1 text-sm text-emerald-900">
                  <p className="font-bold text-base">{selectedDailyContract.nomor_kontrak}</p>
                  <p>Pihak 1: <strong>{selectedDailyContract.pihak_pertama_nama}</strong> | Pihak 2: <strong>{selectedDailyContract.pihak_kedua_nama}</strong></p>
                  <p>Tarif Harian: <strong className="text-emerald-700">Rp {(selectedDailyContract.tarif_harian || 0).toLocaleString('id-ID')} / Hari</strong> | Rekening: {selectedDailyContract.bank_nama} {selectedDailyContract.bank_rekening} a.n {selectedDailyContract.bank_atas_nama}</p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-bold text-base">Timesheet Harian yang Akan Ditagihkan ({filteredDailyTimesheets.length} Entri)</h3>
                {filteredDailyTimesheets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center border rounded bg-muted/20">
                    Tidak ada timesheet harian yang tersedia/belum ditagih pada filter ini.
                  </p>
                ) : (
                  <div className="overflow-x-auto border rounded max-h-64 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted sticky top-0 border-b">
                        <tr>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Nopol</th>
                          <th className="p-2">Lokasi / STA</th>
                          <th className="p-2">Kegiatan</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Jumlah Hari</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredDailyTimesheets.map(ts => (
                          <tr key={ts.id}>
                            <td className="p-2 font-medium">{format(new Date(ts.tanggal), 'dd/MM/yyyy')}</td>
                            <td className="p-2 font-mono font-bold">{ts.plat_nomor}</td>
                            <td className="p-2 font-medium text-emerald-700">{ts.lokasi_detail}</td>
                            <td className="p-2">{ts.kegiatan || '-'}</td>
                            <td className="p-2 uppercase">{ts.status_kerja}</td>
                            <td className="p-2 font-semibold">{ts.jumlah_hari} Hari</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* FINANCIAl SUMMARY */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/40 rounded border">
                <div>
                  <p className="text-xs text-muted-foreground">Total Unit-Hari</p>
                  <p className="text-xl font-bold">{dtTotalHari} Hari</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal Kotor</p>
                  <p className="text-xl font-bold">Rp {dtTotalKotor.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Potongan PPh 2%</p>
                  <p className="text-xl font-bold text-rose-600">- Rp {dtTotalPph.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Nett Tagihan</p>
                  <p className="text-xl font-bold text-emerald-600">Rp {dtTotalNett.toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  onClick={handleCreateDailyInvoice} 
                  disabled={filteredDailyTimesheets.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto" 
                  size="lg"
                >
                  <FileText className="w-4 h-4 mr-2" /> Simpan Invoice DT Harian Final
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print Modal */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cetak Invoice</DialogTitle>
            <DialogDescription>
              Invoice <strong>{invoiceToPrint?.nomor_invoice}</strong> siap dicetak.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 border rounded bg-muted/50">
              <Button 
                type="button" 
                variant={includePhotos ? "default" : "outline"} 
                onClick={() => setIncludePhotos(!includePhotos)}
                className="w-full flex justify-center gap-2"
              >
                {includePhotos ? <CheckSquare className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                {includePhotos ? 'Foto Bukti DO Akan Dilampirkan' : 'Sertakan Foto Bukti DO?'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template Invoice</Label>
                <Select value={invoiceTemplate} onValueChange={(val: any) => setInvoiceTemplate(val)}>
                  <SelectTrigger><SelectValue placeholder="Pilih Template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Template 1 (Standar / Detail)</SelectItem>
                    <SelectItem value="classic">Template 2 (Klasik / TAMPLATE_INV_2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Warna Aksen</Label>
                <Select value={accentColor} onValueChange={setAccentColor}>
                  <SelectTrigger><SelectValue placeholder="Pilih Warna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#00B0F0">🔵 Biru Cyan</SelectItem>
                    <SelectItem value="#f8cbad">🍑 Peach Warm (Classic)</SelectItem>
                    <SelectItem value="#10b981">🟢 Hijau Emerald</SelectItem>
                    <SelectItem value="#1e293b">🌑 Navy Dark</SelectItem>
                    <SelectItem value="#e11d48">🔴 Merah Crimson</SelectItem>
                    <SelectItem value="#f59e0b">🟡 Kuning Amber</SelectItem>
                    <SelectItem value="#8b5cf6">🟣 Ungu Violet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ukuran Kertas</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger><SelectValue placeholder="Pilih Ukuran" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4 portrait">A4 Portrait</SelectItem>
                    <SelectItem value="A4 landscape">A4 Landscape</SelectItem>
                    <SelectItem value="Legal portrait">Legal Portrait (F4)</SelectItem>
                    <SelectItem value="Legal landscape">Legal Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Skala Cetak (%)</Label>
                <Input type="number" min="50" max="150" value={printScale} onChange={(e) => setPrintScale(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setPrintModalOpen(false)}>Batal</Button>
            <Button onClick={executePrint}><Printer className="w-4 h-4 mr-2" /> Proses Cetak PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-100">
          <DialogHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 border-b pb-3">
            <div>
              <DialogTitle>Preview Invoice {invoiceToPrint?.nomor_invoice}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">Ubah template dan warna aksen secara langsung di bawah ini</DialogDescription>
            </div>
            {invoiceToPrint?.tipe_invoice !== 'harian' && (
              <div className="flex gap-2">
                <Select value={invoiceTemplate} onValueChange={(val: any) => setInvoiceTemplate(val)}>
                  <SelectTrigger className="w-[200px] bg-white"><SelectValue placeholder="Pilih Template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Template 1 (Standar)</SelectItem>
                    <SelectItem value="classic">Template 2 (Klasik TAMPLATE_INV_2)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={accentColor} onValueChange={setAccentColor}>
                  <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="Warna Aksen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#00B0F0">🔵 Biru Cyan</SelectItem>
                    <SelectItem value="#f8cbad">🍑 Peach Warm</SelectItem>
                    <SelectItem value="#10b981">🟢 Hijau Emerald</SelectItem>
                    <SelectItem value="#1e293b">🌑 Navy Dark</SelectItem>
                    <SelectItem value="#e11d48">🔴 Merah Crimson</SelectItem>
                    <SelectItem value="#f59e0b">🟡 Kuning Amber</SelectItem>
                    <SelectItem value="#8b5cf6">🟣 Ungu Violet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogHeader>
          
          <div className="bg-white rounded shadow-sm border border-gray-200">
             {invoiceToPrint && invoiceToPrint.tipe_invoice === 'harian' ? (
                <PrintDailyInvoice
                  invoice={invoiceToPrint}
                  contract={dailyContracts?.find(c => c.id === invoiceToPrint.daily_contract_id)}
                  timesheets={timesheetsForPrint || []}
                  owner={selectedOwner || undefined}
                  proyek={selectedProyek || undefined}
                  includePhotos={includePhotos}
                  paperSize={paperSize}
                  printScale={printScale}
                  isPreview={true}
                />
             ) : (
                invoiceToPrint && tripsForPrint && selectedOwner && selectedProyek && (
                  <PrintInvoice
                    invoice={invoiceToPrint}
                    trips={tripsForPrint}
                    owner={selectedOwner}
                    proyek={selectedProyek}
                    proyekLokasis={proyekLokasis || []}
                    lokasiProyeks={lokasiProyeks || []}
                    lokasiKuaris={lokasiKuaris || []}
                    jenisJasas={jenisJasas || []}
                    jenisMaterials={jenisMaterials || []}
                    includePhotos={includePhotos}
                    paperSize={paperSize}
                    printScale={printScale}
                    isPreview={true}
                    templateType={invoiceTemplate}
                    accentColor={accentColor}
                  />
                )
             )}
          </div>
          
          <DialogFooter className="mt-4">
             <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>Tutup</Button>
             <Button onClick={() => { setPreviewModalOpen(false); executePrint(); }}><Printer className="w-4 h-4 mr-2"/> Cetak Sekarang</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Layout */}
      {invoiceToPrint && invoiceToPrint.tipe_invoice === 'harian' ? (
        <PrintDailyInvoice
          invoice={invoiceToPrint}
          contract={dailyContracts?.find(c => c.id === invoiceToPrint.daily_contract_id)}
          timesheets={timesheetsForPrint || []}
          owner={selectedOwner || undefined}
          proyek={selectedProyek || undefined}
          includePhotos={includePhotos}
          paperSize={paperSize}
          printScale={printScale}
        />
      ) : (
        invoiceToPrint && tripsForPrint && selectedOwner && selectedProyek && (
          <PrintInvoice
            invoice={invoiceToPrint}
            trips={tripsForPrint}
            owner={selectedOwner}
            proyek={selectedProyek}
            proyekLokasis={proyekLokasis || []}
            lokasiProyeks={lokasiProyeks || []}
            lokasiKuaris={lokasiKuaris || []}
            jenisJasas={jenisJasas || []}
            jenisMaterials={jenisMaterials || []}
            includePhotos={includePhotos}
            paperSize={paperSize}
            printScale={printScale}
            templateType={invoiceTemplate}
            accentColor={accentColor}
          />
        )
      )}
    </div>
  );
}
