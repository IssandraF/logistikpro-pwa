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
import { printWithTitle } from '@/lib/print-utils';
import { exportInvoiceExcel } from '@/lib/excel-utils';
import { exportSmartInvoices, importSmartInvoices } from '@/lib/sync-utils';

export default function Invoices() {
  const [activeTab, setActiveTab] = useState('data');

  const invoices = useLiveQuery(() => db.invoices.reverse().toArray());
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const pendingTrips = useLiveQuery(() => db.trips.filter(t => !t.invoice_id && t.isDeleted === 0).toArray());
  const lokasiKuaris = useLiveQuery(() => db.lokasiKuaris.toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.toArray());
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.toArray());
  const owners = useLiveQuery(() => db.owners.where('isDeleted').equals(0).toArray());

  const [nomorInvoice, setNomorInvoice] = useState('');
  const [tglInvoice, setTglInvoice] = useState('');
  const [proyekId, setProyekId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [kepadaCustom, setKepadaCustom] = useState('');
  const [namaTtd, setNamaTtd] = useState('');

  // Print States
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);
  const [includePhotos, setIncludePhotos] = useState(false);
  const tripsForPrint = useLiveQuery(
    () => invoiceToPrint ? db.trips.where('invoice_id').equals(invoiceToPrint.id).toArray() : Promise.resolve([]),
    [invoiceToPrint]
  );
  
  const [paperSize, setPaperSize] = useState('A4 portrait');
  const [printScale, setPrintScale] = useState(100);
  
  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInvId, setEditInvId] = useState<number | null>(null);
  const [editNomor, setEditNomor] = useState('');
  const [editTgl, setEditTgl] = useState('');
  const [editKepada, setEditKepada] = useState('');
  const [editTtd, setEditTtd] = useState('');
  
  // Filter Tanggal Trip
  const [filterMulai, setFilterMulai] = useState('');
  const [filterAkhir, setFilterAkhir] = useState('');
  
  // Kuari prices state: { [kuari_id]: harga_potong }
  const [kuariPrices, setKuariPrices] = useState<Record<number, number>>({});

  // Memoized calculations for selected project
  const { filteredTrips, kuariSummary, totalVolume, totalKotor } = useMemo(() => {
    if (!proyekId || !pendingTrips || !proyekLokasis) return { filteredTrips: [], kuariSummary: [], totalVolume: 0, totalKotor: 0 };
    
    // Get all ProyekLokasi IDs for the selected Proyek
    const pId = Number(proyekId);
    const validProyekLokasiIds = proyekLokasis.filter(pl => pl.proyek_id === pId).map(pl => pl.id);

    let filtered = pendingTrips.filter(t => validProyekLokasiIds.includes(t.proyek_lokasi_id));

    if (filterMulai) {
      const start = new Date(filterMulai);
      filtered = filtered.filter(t => new Date(t.tanggal_bongkar) >= start);
    }
    if (filterAkhir) {
      const end = new Date(filterAkhir);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.tanggal_bongkar) <= end);
    }
    
    let vol = 0;
    let kotor = 0;
    const kuariMap: Record<number, number> = {}; // kuari_id -> trip count

    filtered.forEach(t => {
      vol += t.volume;
      kotor += t.total_harga;
      kuariMap[t.lokasi_kuari_id] = (kuariMap[t.lokasi_kuari_id] || 0) + 1;
    });

    const summary = Object.keys(kuariMap).map(kId => ({
      kuariId: Number(kId),
      count: kuariMap[Number(kId)]
    }));

    return { filteredTrips: filtered, kuariSummary: summary, totalVolume: vol, totalKotor: kotor };
  }, [proyekId, pendingTrips, proyekLokasis, filterAkhir, filterMulai]);

  const totalPotongan = useMemo(() => {
    return kuariSummary.reduce((acc, curr) => {
      const price = kuariPrices[curr.kuariId] || 0;
      return acc + (curr.count * price);
    }, 0);
  }, [kuariSummary, kuariPrices]);

  const totalBersih = totalKotor - totalPotongan;

  const handlePriceChange = (kId: number, val: string) => {
    setKuariPrices(prev => ({ ...prev, [kId]: Number(val) }));
  };

  const handleCreateInvoice = async () => {
    if (!proyekId || !nomorInvoice || !tglInvoice || !ownerId) {
      toast.error('Harap isi Perusahaan, Proyek, Nomor Invoice, dan Tanggal Invoice');
      return;
    }

    if (filteredTrips.length === 0) {
      toast.error('Tidak ada trip pending untuk proyek ini');
      return;
    }

    try {
      // 1. Create Invoice
      const invoiceId = await db.invoices.add({
        nomor_invoice: nomorInvoice,
        tanggal_invoice: new Date(tglInvoice),
        proyek_id: Number(proyekId),
        owner_id: Number(ownerId),
        total_kubikasi: totalVolume,
        total_harga_kotor: totalKotor,
        is_potong_material: totalPotongan > 0 ? 1 : 0,
        total_potongan_material: totalPotongan,
        total_harga_bersih: totalBersih,
        kepada_custom: kepadaCustom || undefined,
        nama_ttd: namaTtd || undefined,
        status: 'draft',
        createdAt: new Date()
      });

      // 2. Add Quarry Prices if any
      for (const summary of kuariSummary) {
        if (kuariPrices[summary.kuariId]) {
          await db.invoiceQuarryPrices.add({
            invoice_id: Number(invoiceId),
            lokasi_kuari_id: summary.kuariId,
            jumlah_trip: summary.count,
            harga_material_override: kuariPrices[summary.kuariId]
          });
        }
      }

      // 3. Update Trips
      const tripIds = filteredTrips.map(t => t.id!);
      await db.trips.where('id').anyOf(tripIds).modify({ invoice_id: Number(invoiceId) });

      toast.success('Invoice berhasil dibuat!');
      setActiveTab('data');
      
      // Reset Form
      setProyekId('');
      setNomorInvoice('');
      setTglInvoice('');
      setKuariPrices({});
      setKepadaCustom('');
      setFilterMulai('');
      setFilterAkhir('');
    } catch {
      toast.error('Gagal membuat invoice');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportExcelSingle = async (inv: any) => {
    const invTrips = await db.trips.where('invoice_id').equals(inv.id).toArray();
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
    if (confirm(`Yakin HAPUS Invoice ${inv.nomor_invoice}? Seluruh trip di dalamnya akan kembali menjadi PENDING.`)) {
      try {
        const trips = await db.trips.where('invoice_id').equals(inv.id).toArray();
        const tripIds = trips.map(t => t.id!);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.trips.where('id').anyOf(tripIds).modify((t: any) => { t.invoice_id = null; });
        await db.invoiceQuarryPrices.where('invoice_id').equals(inv.id).delete();
        await db.invoices.delete(inv.id);

        toast.success('Invoice dihapus & Trip di-rollback!');
      } catch {
        toast.error('Gagal menghapus invoice');
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditModal = (inv: any) => {
    setEditInvId(inv.id);
    setEditNomor(inv.nomor_invoice);
    setEditTgl(format(new Date(inv.tanggal_invoice), 'yyyy-MM-dd'));
    setEditKepada(inv.kepada_custom || '');
    setEditTtd(inv.nama_ttd || '');
    setEditModalOpen(true);
  };

  const handleUpdateInvoice = async () => {
    if (!editInvId || !editNomor || !editTgl) return toast.error('Nomor dan Tanggal wajib diisi');
    try {
      await db.invoices.update(editInvId, {
        nomor_invoice: editNomor,
        tanggal_invoice: new Date(editTgl),
        kepada_custom: editKepada || undefined,
        nama_ttd: editTtd || undefined
      });
      toast.success('Invoice berhasil diperbarui');
      setEditModalOpen(false);
    } catch {
      toast.error('Gagal memperbarui invoice');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePreviewClick = (inv: any) => {
    setInvoiceToPrint(inv);
    setIncludePhotos(true);
    setPreviewModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePrintClick = (inv: any) => {
    setInvoiceToPrint(inv);
    setIncludePhotos(false);
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
        <TabsList className="mb-4">
          <TabsTrigger value="data">Data Invoice</TabsTrigger>
          <TabsTrigger value="create">Buat Invoice Baru</TabsTrigger>
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
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Proyek</th>
                      <th className="p-3">Kubikasi</th>
                      <th className="p-3">Harga Bersih</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices?.map(inv => (
                      <tr key={inv.id} className="border-b">
                        <td className="p-3 font-medium">{inv.nomor_invoice}</td>
                        <td className="p-3">{format(new Date(inv.tanggal_invoice), 'dd/MM/yyyy')}</td>
                        <td className="p-3">{proyeks?.find(p => p.id === inv.proyek_id)?.nama_proyek}</td>
                        <td className="p-3">{inv.total_kubikasi}</td>
                        <td className="p-3 font-semibold text-primary">Rp {inv.total_harga_bersih.toLocaleString('id-ID')}</td>
                        <td className="p-3 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => exportExcelSingle(inv)}>
                            <FileDown className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePreviewClick(inv)}>
                            <Eye className="w-4 h-4 text-purple-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePrintClick(inv)}>
                            <Printer className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(inv)}>
                            <Edit className="w-4 h-4 text-orange-600" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteInvoice(inv)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {invoices?.length === 0 && <tr><td colSpan={6} className="p-4 text-center">Belum ada invoice</td></tr>}
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
                 <div className="p-4 bg-muted/50 rounded-md mt-6 border">
                   <h3 className="font-semibold mb-4 text-lg">Ringkasan & Potongan Material</h3>
                   
                   <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="p-4 bg-background border rounded shadow-sm">
                       <p className="text-sm text-muted-foreground">Total Trip</p>
                       <p className="text-2xl font-bold">{filteredTrips.length} Rit</p>
                     </div>
                     <div className="p-4 bg-background border rounded shadow-sm">
                       <p className="text-sm text-muted-foreground">Total Kubikasi</p>
                       <p className="text-2xl font-bold">{totalVolume.toFixed(2)} M³</p>
                     </div>
                     <div className="col-span-2 p-4 bg-background border rounded shadow-sm">
                       <p className="text-sm text-muted-foreground">Harga Kotor</p>
                       <p className="text-2xl font-bold text-primary">Rp {totalKotor.toLocaleString('id-ID')}</p>
                     </div>
                   </div>

                   {kuariSummary.length > 0 && (
                     <div className="space-y-4 mb-6 bg-background p-4 rounded border">
                       <p className="font-semibold text-sm">Set Harga Potongan Material per Kuari</p>
                       {kuariSummary.map(k => (
                         <div key={k.kuariId} className="flex items-center gap-4">
                           <div className="flex-1">
                             <Label>{lokasiKuaris?.find(l => l.id === k.kuariId)?.nama_lokasi} <span className="text-muted-foreground">({k.count} Trip)</span></Label>
                             <Input 
                               type="number" 
                               placeholder="Harga potong (mis: 50000)" 
                               value={kuariPrices[k.kuariId] || ''} 
                               onChange={e => handlePriceChange(k.kuariId, e.target.value)}
                             />
                           </div>
                           <div className="w-32 text-right">
                             <span className="text-sm text-muted-foreground block">Subtotal Potongan:</span>
                             <span className="font-medium text-destructive">- Rp {((kuariPrices[k.kuariId] || 0) * k.count).toLocaleString('id-ID')}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   <div className="flex justify-between items-center p-4 bg-primary/10 border border-primary/20 rounded">
                     <span className="font-semibold">Total Bersih yang Ditagihkan:</span>
                     <span className="text-2xl font-bold text-primary">Rp {totalBersih.toLocaleString('id-ID')}</span>
                   </div>

                   <Button onClick={handleCreateInvoice} className="w-full mt-6" size="lg">
                     <FileText className="w-4 h-4 mr-2" /> Simpan Invoice Final
                   </Button>
                 </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print Modal */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cetak Invoice</DialogTitle>
            <DialogDescription>
              Invoice <strong>{invoiceToPrint?.nomor_invoice}</strong> siap dicetak.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 p-4 border rounded bg-muted/50">
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
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>Ukuran Kertas</Label>
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
            <div className="space-y-2">
              <Label>Skala Cetak (%)</Label>
              <Input type="number" min="50" max="150" value={printScale} onChange={(e) => setPrintScale(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintModalOpen(false)}>Batal</Button>
            <Button onClick={executePrint}><Printer className="w-4 h-4 mr-2" /> Proses Cetak PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Metadata Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nomor Invoice</Label>
              <Input value={editNomor} onChange={e => setEditNomor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Invoice</Label>
              <Input type="date" value={editTgl} onChange={e => setEditTgl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kepada (Custom)</Label>
              <Input value={editKepada} onChange={e => setEditKepada(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nama Penanda Tangan</Label>
              <Input value={editTtd} onChange={e => setEditTtd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateInvoice}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-100">
          <DialogHeader className="mb-4">
            <DialogTitle>Preview Invoice {invoiceToPrint?.nomor_invoice}</DialogTitle>
          </DialogHeader>
          
          <div className="bg-white rounded shadow-sm border border-gray-200">
             {invoiceToPrint && tripsForPrint && selectedOwner && selectedProyek && (
                <PrintInvoice
                  invoice={invoiceToPrint}
                  trips={tripsForPrint}
                  owner={selectedOwner}
                  proyek={selectedProyek}
                  proyekLokasis={proyekLokasis || []}
                  lokasiProyeks={lokasiProyeks || []}
                  lokasiKuaris={lokasiKuaris || []}
                  includePhotos={includePhotos}
                  paperSize={paperSize}
                  printScale={printScale}
                  isPreview={true}
                />
              )}
          </div>
          
          <DialogFooter className="mt-4">
             <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>Tutup</Button>
             <Button onClick={() => { setPreviewModalOpen(false); executePrint(); }}><Printer className="w-4 h-4 mr-2"/> Cetak Sekarang</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Layout */}
      {invoiceToPrint && tripsForPrint && selectedOwner && selectedProyek && (
        <PrintInvoice
          invoice={invoiceToPrint}
          trips={tripsForPrint}
          owner={selectedOwner}
          proyek={selectedProyek}
          proyekLokasis={proyekLokasis || []}
          lokasiProyeks={lokasiProyeks || []}
          lokasiKuaris={lokasiKuaris || []}
          includePhotos={includePhotos}
          paperSize={paperSize}
          printScale={printScale}
        />
      )}
    </div>
  );
}
