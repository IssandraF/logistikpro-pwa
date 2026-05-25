import Dexie, { type Table } from 'dexie';

// === Interfaces ===

export interface StoreSettings {
  id?: number;
  // Ini hanya untuk nama/logo PWA secara general
  companyName: string;
  logoUrl?: string; 
  themeColor?: string;
  lastBackupAt?: Date;
  userName?: string;
  userAvatar?: string;
}

export interface Owner {
  id?: number;
  nama: string; // Nama Perusahaan/Owner
  nama_bank: string;
  no_rek: string;
  atas_nama: string;
  createdAt: Date;
  isDeleted: number;
}

export interface GrupMobil {
  id?: number;
  nama_grup: string;
  owner_nama?: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
}

export interface Proyek {
  id?: number;
  nama_proyek: string;
  createdAt: Date;
  isDeleted: number;
}

export interface LokasiProyek {
  id?: number;
  nama_lokasi: string;
  createdAt: Date;
  isDeleted: number;
}

export interface LokasiKuari {
  id?: number;
  nama_lokasi: string;
  createdAt: Date;
  isDeleted: number;
}

export interface JenisJasa {
  id?: number;
  nama_js: string;
  createdAt: Date;
  isDeleted: number;
}

export interface JenisMaterial {
  id?: number;
  nama_material: string;
  createdAt: Date;
  isDeleted: number;
}

export interface ProyekLokasi {
  id?: number;
  proyek_id: number;
  lokasi_proyek_id: number;
  jarak?: number;
  harga?: number;
  createdAt: Date;
  isDeleted: number;
}

export interface Trip {
  id?: number;
  grup_mobil_id: number;
  plat_nomor: string;
  lokasi_kuari_id: number;
  proyek_lokasi_id: number;
  jenis_jasa_id: number;
  volume: number;
  harga_trip: number;
  total_harga: number; // volume * harga_trip
  tanggal_muat: Date;
  tanggal_bongkar: Date;
  bukti_do?: string; // base64 compressed image
  invoice_id: number | null;
  slip_pembayaran_id: number | null;
  harga_bayar?: number; // diisi ketika dibuat slip pembayaran
  potongan_trip?: number; // potongan material per trip ketika dibuat slip
  jenis_material_id?: number | null; // untuk mengelompokkan jenis material
  potongan_material_invoice?: number; // potongan nominal material manual di invoice
  createdAt: Date;
  isDeleted: number;
}

export interface Invoice {
  id?: number;
  nomor_invoice: string;
  tanggal_invoice: Date;
  proyek_id: number;
  owner_id: number; // Relasi ke tabel Owner (Perusahaan)
  total_kubikasi: number;
  total_harga_kotor: number;
  is_potong_material: number;
  total_potongan_material: number;
  total_harga_bersih: number;
  kepada_custom?: string;
  nama_ttd?: string;
  status: 'draft' | 'lunas';
  createdAt: Date;
}

export interface InvoiceQuarryPrice {
  id?: number;
  invoice_id: number;
  lokasi_kuari_id: number;
  jumlah_trip: number;
  harga_material_override: number;
}

export interface SlipPembayaran {
  id?: number;
  nomor_slip: string;
  tanggal: Date;
  grup_mobil_id: number;
  total_trip_ongkos: number;
  potongan_material: number;
  potongan_kasbon: number;
  total_bersih_dibayar: number;
  sisa_kasbon_setelah_bayar: number | null;
  status: 'draft' | 'lunas';
  createdAt: Date;
}

export interface PinjamanGrup {
  id?: number;
  grup_mobil_id: number;
  total_pinjaman: number;
  total_potongan: number;
  sisa_kasbon: number;
}

export interface KasbonMutasi {
  id?: number;
  grup_mobil_id: number;
  slip_pembayaran_id: number;
  jenis: 'potongan' | 'penambahan';
  nominal: number;
  keterangan: string;
  tanggal: Date;
}

export interface Kas {
  id?: number;
  jenis: 'masuk' | 'keluar';
  nominal: number;
  keterangan: string;
  tanggal: Date;
  slip_pembayaran_id?: number | null;
  invoice_id?: number | null;
}

// === Database Class ===
class LogistikDatabase extends Dexie {
  storeSettings!: Table<StoreSettings>;
  owners!: Table<Owner>;
  grupMobils!: Table<GrupMobil>;
  proyeks!: Table<Proyek>;
  lokasiProyeks!: Table<LokasiProyek>;
  lokasiKuaris!: Table<LokasiKuari>;
  jenisJasas!: Table<JenisJasa>;
  jenisMaterials!: Table<JenisMaterial>;
  proyekLokasis!: Table<ProyekLokasi>;
  trips!: Table<Trip>;
  invoices!: Table<Invoice>;
  invoiceQuarryPrices!: Table<InvoiceQuarryPrice>;
  slipPembayarans!: Table<SlipPembayaran>;
  pinjamanGrups!: Table<PinjamanGrup>;
  kasbonMutasis!: Table<KasbonMutasi>;
  kas!: Table<Kas>;

  constructor() {
    super('logistikpro-db');

    this.version(1).stores({
      storeSettings: '++id',
      grupMobils: '++id, nama_grup, isDeleted',
      proyeks: '++id, nama_proyek, isDeleted',
      lokasiProyeks: '++id, nama_lokasi, isDeleted',
      lokasiKuaris: '++id, nama_lokasi, isDeleted',
      jenisJasas: '++id, nama_js, isDeleted',
      proyekLokasis: '++id, proyek_id, lokasi_proyek_id, isDeleted',
      trips: '++id, grup_mobil_id, plat_nomor, proyek_lokasi_id, lokasi_kuari_id, invoice_id, slip_pembayaran_id, tanggal_bongkar, isDeleted',
      invoices: '++id, proyek_id, nomor_invoice',
      invoiceQuarryPrices: '++id, invoice_id, lokasi_kuari_id',
      slipPembayarans: '++id, grup_mobil_id, nomor_slip',
      pinjamanGrups: '++id, grup_mobil_id',
      kasbonMutasis: '++id, grup_mobil_id, slip_pembayaran_id, tanggal',
      kas: '++id, jenis, tanggal, slip_pembayaran_id, invoice_id',
    });

    this.version(2).stores({
      owners: '++id, isDeleted'
    }).upgrade(() => {
      // Tambahkan owner_id ke existing invoices jika diperlukan
    });

    this.version(3).stores({
      jenisMaterials: '++id, nama_material, isDeleted'
    });
  }
}

export const db = new LogistikDatabase();

// Seed Default Data Function
export async function seedDefaultSettings() {
  const settingsCount = await db.storeSettings.count();
  if (settingsCount === 0) {
    await db.storeSettings.add({
      companyName: 'LogistikPro PWA',
    });
  }
}
