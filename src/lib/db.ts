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
  invoice_id: number | null; // Untuk penagihan agen/internal (Template 1)
  invoice_proyek_id?: number | null; // Untuk penagihan proyek/eksternal (Template 2)
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
  tipe_invoice?: 'trip' | 'harian';
  kategori_invoice?: 'agen' | 'proyek'; // agen = Template 1, proyek = Template 2
  daily_contract_id?: number | null;
  total_pph?: number;
  pph_persen?: number;
  rekening_bank?: string;
  volume_ditagih?: number;
  sisa_volume?: number;
  sisa_volume_sebelumnya?: number;
  harga_per_kubik?: number;
  is_custom_total?: boolean;
  sisa_invoice_sebelumnya?: number;
  total_keseluruhan?: number;
  nomor_invoice_sebelumnya?: string;
  ttd_image?: string;
  createdAt: Date;
}

export interface DailyContract {
  id?: number;
  nomor_kontrak: string;
  pihak_pertama_nama: string;
  pihak_pertama_nik?: string;
  pihak_pertama_alamat?: string;
  pihak_pertama_hp?: string;
  pihak_kedua_nama: string;
  pihak_kedua_nik?: string;
  pihak_kedua_alamat?: string;
  pihak_kedua_hp?: string;
  proyek_id: number;
  lokasi_proyek_nama?: string;
  lokasi_proyek_list?: string[];
  tarif_harian: number; // e.g. 1600000
  pph_persen: number; // e.g. 2
  bank_nama?: string; // e.g. Mandiri
  bank_rekening?: string; // e.g. 1080030788005
  bank_atas_nama?: string; // e.g. Irma Fitriani Dalimunte
  unit_nopol_list?: string[];
  tanggal_mulai?: Date;
  status: 'aktif' | 'selesai';
  createdAt: Date;
  isDeleted: number;
}

export interface DailyTimesheet {
  id?: number;
  daily_contract_id: number;
  plat_nomor: string;
  tanggal: Date;
  lokasi_detail: string; // e.g. "STA 194"
  kegiatan: string; // e.g. "Timbunan Subgrade"
  status_kerja: 'kerja' | 'standby' | 'breakdown' | 'hujan';
  jumlah_hari: number; // 1 atau 0.5
  operator_nama?: string;
  pengawas_nama?: string;
  bukti_timesheet?: string; // base64 photo
  invoice_id: number | null;
  createdAt: Date;
  isDeleted: number;
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
  kasbon_mutasi_id?: number | null;
  is_closed?: number;
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
  dailyContracts!: Table<DailyContract>;
  dailyTimesheets!: Table<DailyTimesheet>;

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

    this.version(4).stores({
      dailyContracts: '++id, nomor_kontrak, proyek_id, isDeleted',
      dailyTimesheets: '++id, daily_contract_id, plat_nomor, tanggal, invoice_id, isDeleted'
    });

    this.version(5).stores({
      kas: '++id, jenis, tanggal, slip_pembayaran_id, invoice_id, kasbon_mutasi_id, is_closed'
    }).upgrade(async (tx) => {
      return tx.table('kas').toCollection().modify(k => {
        k.is_closed = 0;
      });
    });

    this.version(6).stores({
      trips: '++id, grup_mobil_id, plat_nomor, proyek_lokasi_id, lokasi_kuari_id, invoice_id, invoice_proyek_id, slip_pembayaran_id, tanggal_bongkar, isDeleted',
    }).upgrade(async (tx) => {
      return tx.table('invoices').toCollection().modify(inv => {
        if (!inv.kategori_invoice) {
          inv.kategori_invoice = 'agen'; // Default data lama ke agen/internal
        }
      });
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
