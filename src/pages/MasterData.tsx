import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState('grup-mobil');

  // Grup Mobil
  const grupMobils = useLiveQuery(() => db.grupMobils.where('isDeleted').equals(0).toArray());
  const [namaGrup, setNamaGrup] = useState('');
  const [ownerNama, setOwnerNama] = useState('');

  const addGrupMobil = async () => {
    if (!namaGrup) return toast.error('Nama grup wajib diisi');
    await db.grupMobils.add({ nama_grup: namaGrup, owner_nama: ownerNama, createdAt: new Date(), isDeleted: 0 });
    setNamaGrup('');
    setOwnerNama('');
    toast.success('Grup Mobil berhasil ditambahkan');
  };

  const deleteGrupMobil = async (id: number) => {
    await db.grupMobils.update(id, { isDeleted: 1 });
    toast.success('Dihapus');
  };

  // Proyek
  const proyeks = useLiveQuery(() => db.proyeks.where('isDeleted').equals(0).toArray());
  const [namaProyek, setNamaProyek] = useState('');
  const addProyek = async () => {
    if (!namaProyek) return;
    await db.proyeks.add({ nama_proyek: namaProyek, createdAt: new Date(), isDeleted: 0 });
    setNamaProyek('');
    toast.success('Proyek berhasil ditambahkan');
  };

  // Lokasi Kuari
  const lokasiKuaris = useLiveQuery(() => db.lokasiKuaris.where('isDeleted').equals(0).toArray());
  const [namaKuari, setNamaKuari] = useState('');
  const addKuari = async () => {
    if (!namaKuari) return;
    await db.lokasiKuaris.add({ nama_lokasi: namaKuari, createdAt: new Date(), isDeleted: 0 });
    setNamaKuari('');
    toast.success('Lokasi Kuari berhasil ditambahkan');
  };

  // Jenis Jasa
  const jenisJasas = useLiveQuery(() => db.jenisJasas.where('isDeleted').equals(0).toArray());
  const [namaJs, setNamaJs] = useState('');
  const addJs = async () => {
    if (!namaJs) return;
    await db.jenisJasas.add({ nama_js: namaJs, createdAt: new Date(), isDeleted: 0 });
    setNamaJs('');
  };

  // Rute Tujuan (Proyek Lokasi Pivot)
  const lokasiProyeks = useLiveQuery(() => db.lokasiProyeks.where('isDeleted').equals(0).toArray());
  const proyekLokasis = useLiveQuery(() => db.proyekLokasis.where('isDeleted').equals(0).toArray());
  const [selectedProyekId, setSelectedProyekId] = useState('');
  const [namaLokasiRute, setNamaLokasiRute] = useState('');
  const [jarakRute, setJarakRute] = useState('');

  const addRuteTujuan = async () => {
    if (!selectedProyekId || !namaLokasiRute) return toast.error('Pilih Proyek dan isi Nama Lokasi Tujuan');
    
    const lokasiId = await db.lokasiProyeks.add({
      nama_lokasi: namaLokasiRute,
      createdAt: new Date(),
      isDeleted: 0
    });

    await db.proyekLokasis.add({
      proyek_id: Number(selectedProyekId),
      lokasi_proyek_id: Number(lokasiId),
      jarak: Number(jarakRute) || 0,
      harga: 0,
      createdAt: new Date(),
      isDeleted: 0
    });

    toast.success('Rute Tujuan berhasil ditambahkan');
    setNamaLokasiRute('');
    setJarakRute('');
  };

  const deleteRute = async (pivotId: number, lokasiId: number) => {
    await db.proyekLokasis.update(pivotId, { isDeleted: 1 });
    await db.lokasiProyeks.update(lokasiId, { isDeleted: 1 });
    toast.success('Rute Dihapus');
  };

  // Perusahaan (Owner)
  const owners = useLiveQuery(() => db.owners.where('isDeleted').equals(0).toArray());
  const [namaOwner, setNamaOwner] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankAccName, setBankAccName] = useState('');

  const addOwner = async () => {
    if (!namaOwner || !bankName || !bankAcc || !bankAccName) return toast.error('Isi semua field perusahaan/owner');
    await db.owners.add({
      nama: namaOwner,
      nama_bank: bankName,
      no_rek: bankAcc,
      atas_nama: bankAccName,
      createdAt: new Date(),
      isDeleted: 0
    });
    setNamaOwner(''); setBankName(''); setBankAcc(''); setBankAccName('');
    toast.success('Perusahaan berhasil ditambahkan');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Data Master</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto gap-2">
          <TabsTrigger value="grup-mobil">Grup Mobil</TabsTrigger>
          <TabsTrigger value="perusahaan">Perusahaan (Pengirim)</TabsTrigger>
          <TabsTrigger value="proyek">Proyek</TabsTrigger>
          <TabsTrigger value="rute-proyek">Rute Tujuan</TabsTrigger>
          <TabsTrigger value="lokasi-kuari">Lokasi Kuari</TabsTrigger>
          <TabsTrigger value="jenis-jasa">Jenis Jasa</TabsTrigger>
        </TabsList>

        <TabsContent value="perusahaan">
          <Card>
            <CardHeader><CardTitle>Perusahaan / Pengirim Invoice</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>Nama Perusahaan / Pemilik</Label>
                  <Input value={namaOwner} onChange={e => setNamaOwner(e.target.value)} placeholder="Misal: PT Logistik / Bapak Budi" />
                </div>
                <div className="space-y-2">
                  <Label>Nama Bank</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="BCA" />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Rekening</Label>
                  <Input value={bankAcc} onChange={e => setBankAcc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Atas Nama</Label>
                  <Input value={bankAccName} onChange={e => setBankAccName(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={addOwner} className="w-full"><Plus className="w-4 h-4 mr-2"/> Tambah Perusahaan</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {owners?.map(o => (
                  <li key={o.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-bold">{o.nama}</p>
                      <p className="text-sm text-muted-foreground">{o.nama_bank} - {o.no_rek} a/n {o.atas_nama}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => db.owners.update(o.id!, { isDeleted: 1 })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grup-mobil">
          <Card>
            <CardHeader>
              <CardTitle>Grup Mobil / Vendor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Grup/Truk</Label>
                  <Input value={namaGrup} onChange={e => setNamaGrup(e.target.value)} placeholder="Contoh: Budi Trans" />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Nama Owner (Opsional)</Label>
                  <Input value={ownerNama} onChange={e => setOwnerNama(e.target.value)} placeholder="Contoh: Pak Budi" />
                </div>
                <div className="flex items-end">
                  <Button onClick={addGrupMobil}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                </div>
              </div>

              <div className="border rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3">Nama Grup</th>
                      <th className="p-3">Owner</th>
                      <th className="p-3 w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupMobils?.map(g => (
                      <tr key={g.id} className="border-t">
                        <td className="p-3">{g.nama_grup}</td>
                        <td className="p-3">{g.owner_nama || '-'}</td>
                        <td className="p-3 flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => deleteGrupMobil(g.id!)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {grupMobils?.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Belum ada data</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proyek">
          <Card>
            <CardHeader><CardTitle>Proyek</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Proyek</Label>
                  <Input value={namaProyek} onChange={e => setNamaProyek(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addProyek}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {proyeks?.map(p => (
                  <li key={p.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{p.nama_proyek}</span>
                    <Button variant="ghost" size="icon" onClick={() => db.proyeks.update(p.id!, { isDeleted: 1 })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rute-proyek">
          <Card>
            <CardHeader><CardTitle>Rute Tujuan Proyek</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Proyek Induk</Label>
                  <Select value={selectedProyekId} onValueChange={setSelectedProyekId}>
                    <SelectTrigger><SelectValue placeholder="Pilih Proyek" /></SelectTrigger>
                    <SelectContent>
                      {proyeks?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.nama_proyek}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Nama Tujuan / Rute</Label>
                  <Input value={namaLokasiRute} onChange={e => setNamaLokasiRute(e.target.value)} placeholder="Misal: KM 15 / Stockpile B" />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Jarak (KM) Opsional</Label>
                  <Input type="number" value={jarakRute} onChange={e => setJarakRute(e.target.value)} placeholder="0" />
                </div>
                <div className="flex items-end">
                  <Button onClick={addRuteTujuan}><Plus className="w-4 h-4 mr-2"/> Tambah Rute</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {proyekLokasis?.map(pl => {
                  const pName = proyeks?.find(p => p.id === pl.proyek_id)?.nama_proyek;
                  const lName = lokasiProyeks?.find(l => l.id === pl.lokasi_proyek_id)?.nama_lokasi;
                  return (
                    <li key={pl.id} className="flex items-center justify-between p-3 border rounded-md">
                      <span><strong>{pName}</strong> - {lName} <span className="text-muted-foreground text-sm">({pl.jarak} KM)</span></span>
                      <Button variant="ghost" size="icon" onClick={() => deleteRute(pl.id!, pl.lokasi_proyek_id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </li>
                  )
                })}
                {proyekLokasis?.length === 0 && <p className="text-muted-foreground text-center p-4 border rounded">Belum ada rute</p>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lokasi-kuari">
          <Card>
            <CardHeader><CardTitle>Lokasi Kuari</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Kuari</Label>
                  <Input value={namaKuari} onChange={e => setNamaKuari(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addKuari}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {lokasiKuaris?.map(k => (
                  <li key={k.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{k.nama_lokasi}</span>
                    <Button variant="ghost" size="icon" onClick={() => db.lokasiKuaris.update(k.id!, { isDeleted: 1 })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jenis-jasa">
          <Card>
            <CardHeader><CardTitle>Jenis Jasa</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1 space-y-2">
                  <Label>Nama Jasa</Label>
                  <Input value={namaJs} onChange={e => setNamaJs(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addJs}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {jenisJasas?.map(j => (
                  <li key={j.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span>{j.nama_js}</span>
                    <Button variant="ghost" size="icon" onClick={() => db.jenisJasas.update(j.id!, { isDeleted: 1 })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
