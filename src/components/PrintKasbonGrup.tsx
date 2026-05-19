import { format } from "date-fns";
import type { PinjamanGrup, GrupMobil, KasbonMutasi, SlipPembayaran, Trip, ProyekLokasi, LokasiProyek, LokasiKuari } from "@/lib/db";
import PrintSlip from "./PrintSlip";

interface PrintKasbonGrupProps {
  grupMobil: GrupMobil;
  pinjaman: PinjamanGrup;
  mutasis: KasbonMutasi[];
  slips: SlipPembayaran[];
  allTrips: Trip[];
  proyekLokasis: ProyekLokasi[];
  lokasiProyeks: LokasiProyek[];
  lokasiKuaris: LokasiKuari[];
}

export default function PrintKasbonGrup({
  grupMobil, pinjaman, mutasis, slips, allTrips, proyekLokasis, lokasiProyeks, lokasiKuaris
}: PrintKasbonGrupProps) {

  // Hanya mutasi penambahan yang ditampilkan di tabel Riwayat Pengambilan Kasbon
  const mutasiPengambilan = mutasis.filter(m => m.jenis === 'penambahan').sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  
  // Slips yang memiliki potongan_kasbon > 0
  const slipsWithKasbon = slips.filter(s => s.potongan_kasbon > 0).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  return (
    <div className="hidden print:block printable-invoice">
      <div className="text-center font-bold underline mb-5 text-[18px]">REKAPITULASI KASBON VENDOR</div>

      <table className="info-table w-full mb-5 border-none">
        <tbody>
          <tr>
            <td className="w-[20%] border-none p-1">Nama Grup / Vendor</td>
            <td className="w-[40%] border-none p-1">: <span className="font-bold">{grupMobil.nama_grup.toUpperCase()}</span></td>
            <td className="w-[20%] border-none p-1">Total Pinjaman</td>
            <td className="w-[20%] border-none p-1">: Rp {pinjaman.total_pinjaman.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td className="border-none p-1">PIC / Telp</td>
            <td className="border-none p-1">: {(grupMobil.nama_pic || '-').toUpperCase()} / {grupMobil.no_hp || '-'}</td>
            <td className="border-none p-1">Total Terbayar (Dipotong)</td>
            <td className="border-none p-1">: Rp {pinjaman.total_potongan.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td className="border-none p-1">Tanggal Cetak</td>
            <td className="border-none p-1">: {format(new Date(), 'dd/MM/yyyy HH:mm')}</td>
            <td className="border-none p-1 font-bold text-red-600">SISA KASBON SAAT INI</td>
            <td className="border-none p-1 font-bold text-red-600">: Rp {pinjaman.sisa_kasbon.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-2 font-bold text-[14px]">RIWAYAT PENGAMBILAN KASBON:</p>
      <table className="main-table w-full mb-8">
        <thead>
          <tr>
            <th className="w-[5%]">NO</th>
            <th className="w-[15%]">TANGGAL</th>
            <th className="w-[50%] text-left pl-2">KETERANGAN</th>
            <th className="w-[30%] text-right pr-2">NOMINAL (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {mutasiPengambilan.map((m, idx) => (
            <tr key={m.id}>
              <td className="text-center">{idx + 1}</td>
              <td className="text-center">{format(new Date(m.tanggal), 'dd/MM/yyyy')}</td>
              <td className="text-left pl-2">{m.keterangan}</td>
              <td className="text-right pr-2 text-red-600">{m.nominal.toLocaleString('id-ID')}</td>
            </tr>
          ))}
          {mutasiPengambilan.length === 0 && (
             <tr><td colSpan={4} className="text-center italic">Tidak ada riwayat pengambilan kasbon</td></tr>
          )}
        </tbody>
      </table>

      {slipsWithKasbon.length > 0 && (
        <div style={{ pageBreakBefore: 'always' }}>
           <div className="text-center font-bold text-[16px] mb-6 underline">
             LAMPIRAN SLIP PEMBAYARAN (YANG MEMOTONG KASBON)
           </div>
           
           {slipsWithKasbon.map((slip, index) => {
             const tripsForSlip = allTrips.filter(t => t.slip_pembayaran_id === slip.id);
             return (
               <div key={slip.id} className={index > 0 ? "mt-10 pt-10 border-t-2 border-dashed border-gray-400" : ""}>
                  <PrintSlip
                    slip={slip}
                    trips={tripsForSlip}
                    grupMobil={grupMobil}
                    proyekLokasis={proyekLokasis}
                    lokasiProyeks={lokasiProyeks}
                    lokasiKuaris={lokasiKuaris}
                    isNested={true}
                  />
               </div>
             )
           })}
        </div>
      )}
    </div>
  )
}
