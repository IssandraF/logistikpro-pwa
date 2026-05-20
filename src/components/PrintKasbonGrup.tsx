import { format } from "date-fns";
import type { PinjamanGrup, GrupMobil, KasbonMutasi, SlipPembayaran, Trip, ProyekLokasi, LokasiProyek, LokasiKuari } from "@/lib/db";

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

  // Urutkan mutasi berdasarkan tanggal (ascending) untuk menghitung saldo berjalan
  const sortedMutasi = [...mutasis].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  
  // Slips yang memiliki potongan_kasbon > 0
  const slipsWithKasbon = slips.filter(s => s.potongan_kasbon > 0).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  const mutasiWithSaldo = sortedMutasi.reduce((acc, m) => {
    const prevSaldo = acc.length > 0 ? acc[acc.length - 1].calculatedSaldo : 0;
    const newSaldo = m.jenis === 'penambahan' ? prevSaldo + m.nominal : prevSaldo - m.nominal;
    acc.push({ ...m, calculatedSaldo: newSaldo });
    return acc;
  }, [] as (KasbonMutasi & { calculatedSaldo: number })[]);

  const currentSaldo = mutasiWithSaldo.length > 0 ? mutasiWithSaldo[mutasiWithSaldo.length - 1].calculatedSaldo : 0;

  return (
    <div className="hidden print:block printable-invoice">
      <div className="text-center mb-6">
        <h2 className="text-[20px] font-bold m-0 p-0">RINGKASAN BUKU BESAR KAS BON VENDOR</h2>
        <p className="m-0 p-0 text-gray-600"><strong>{grupMobil.nama_grup.toUpperCase()}</strong> | Tgl Cetak: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>

      <p className="text-[14px] mb-2">
        <strong>Sisa Pinjaman Terakhir:</strong> <span className="text-red-600 font-bold">Rp {pinjaman.sisa_kasbon.toLocaleString('id-ID')}</span>
      </p>

      <table className="w-full border-collapse mb-8 text-[12px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-center w-[5%]">No</th>
            <th className="border border-gray-300 p-2 text-center w-[12%]">Tanggal</th>
            <th className="border border-gray-300 p-2 text-left">Keterangan</th>
            <th className="border border-gray-300 p-2 text-right w-[18%]">Debit (Hutang +)</th>
            <th className="border border-gray-300 p-2 text-right w-[18%]">Kredit (Pelunasan -)</th>
            <th className="border border-gray-300 p-2 text-right w-[18%]">Saldo Berjalan</th>
          </tr>
        </thead>
        <tbody>
          {mutasiWithSaldo.map((m, idx) => {
            let descTitle = 'Mutasi Kasbon';
            if (m.jenis === 'penambahan') descTitle = 'Pinjaman Baru';
            if (m.jenis === 'potongan') descTitle = 'Potongan dari Slip Gaji';

            // Temukan nomor slip jika ini potongan dari slip
            const linkedSlip = m.slip_pembayaran_id ? slips.find(s => s.id === m.slip_pembayaran_id) : null;

            return (
              <tr key={m.id}>
                <td className="border border-gray-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-300 p-2 text-center">{format(new Date(m.tanggal), 'dd/MM/yyyy')}</td>
                <td className="border border-gray-300 p-2 text-left">
                  <strong>{descTitle}</strong>
                  <br/>
                  <span className="text-gray-600">{m.keterangan || '-'}</span>
                  {linkedSlip && (
                    <><br/><span>Slip: {linkedSlip.nomor_slip}</span></>
                  )}
                </td>
                <td className="border border-gray-300 p-2 text-right text-red-600">
                  {m.jenis === 'penambahan' ? m.nominal.toLocaleString('id-ID') : '-'}
                </td>
                <td className="border border-gray-300 p-2 text-right text-green-600">
                  {m.jenis === 'potongan' ? m.nominal.toLocaleString('id-ID') : '-'}
                </td>
                <td className="border border-gray-300 p-2 text-right font-bold">
                  {m.calculatedSaldo.toLocaleString('id-ID')}
                </td>
              </tr>
            );
          })}
          {sortedMutasi.length === 0 && (
             <tr><td colSpan={6} className="border border-gray-300 p-2 text-center">Belum ada riwayat mutasi untuk grup ini.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
             <td colSpan={5} className="border border-gray-300 p-2 text-right font-bold">Total Sisa Saldo Akhir:</td>
             <td className="border border-gray-300 p-2 text-right font-bold">Rp {currentSaldo.toLocaleString('id-ID')}</td>
          </tr>
        </tfoot>
      </table>

      {slipsWithKasbon.length > 0 && (
        <div style={{ pageBreakBefore: 'always' }}>
           <div className="text-center mb-6">
              <h2 className="text-[20px] font-bold m-0 p-0">LAMPIRAN RINCIAN POTONGAN SLIP TAGIHAN</h2>
              <p className="m-0 p-0 text-gray-600">Vendor: <strong>{grupMobil.nama_grup.toUpperCase()}</strong></p>
           </div>
           
           <div className="mt-6">
             {slipsWithKasbon.map((slip) => {
               const tripsForSlip = allTrips.filter(t => t.slip_pembayaran_id === slip.id).sort((a, b) => new Date(a.tanggal_bongkar).getTime() - new Date(b.tanggal_bongkar).getTime());
               
               const nilaiBersihHakVendor = slip.total_bersih_dibayar + slip.potongan_kasbon;
               const totalCashKeluar = slip.total_bersih_dibayar;

               return (
                 <div key={slip.id} className="border border-black mb-5 p-4" style={{ pageBreakInside: 'avoid' }}>
                    <div className="border-b-2 border-black pb-2 mb-4 font-bold text-[14px]">
                       No Slip: {slip.nomor_slip} | Tanggal: {format(new Date(slip.tanggal), 'dd/MM/yyyy')}
                    </div>
                    
                    <table className="w-full border-collapse text-[11px] mb-2">
                       <thead>
                          <tr className="bg-gray-100">
                             <th className="border border-black p-1 text-center w-[12%]">Tgl Trip</th>
                             <th className="border border-black p-1 text-center w-[15%]">Plat Nomor</th>
                             <th className="border border-black p-1 text-left">Rute (Kuari - Proyek)</th>
                             <th className="border border-black p-1 text-right w-[10%]">Volume</th>
                             <th className="border border-black p-1 text-right w-[15%]">Harga/Vol</th>
                             <th className="border border-black p-1 text-right w-[15%]">Total Harga</th>
                          </tr>
                       </thead>
                       <tbody>
                          {tripsForSlip.map(trip => {
                             const kuari = lokasiKuaris.find(k => k.id === trip.lokasi_kuari_id)?.nama_lokasi || '-';
                             const pl = proyekLokasis.find(p => p.id === trip.proyek_lokasi_id);
                             const proyek = pl ? (lokasiProyeks.find(lp => lp.id === pl.lokasi_proyek_id)?.nama_lokasi || '-') : '-';
                             const subtotal = trip.volume * (trip.harga_bayar || 0);

                             return (
                               <tr key={trip.id}>
                                  <td className="border border-black p-1 text-center">{format(new Date(trip.tanggal_bongkar), 'dd/MM/yy')}</td>
                                  <td className="border border-black p-1 text-center">{trip.plat_nomor}</td>
                                  <td className="border border-black p-1 text-left">{kuari} - {proyek}</td>
                                  <td className="border border-black p-1 text-right">{trip.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="border border-black p-1 text-right">{trip.harga_bayar?.toLocaleString('id-ID') || 0}</td>
                                  <td className="border border-black p-1 text-right">{subtotal.toLocaleString('id-ID')}</td>
                               </tr>
                             );
                          })}
                          {tripsForSlip.length === 0 && (
                            <tr><td colSpan={6} className="border border-black p-1 text-center">Tidak ada detail trip.</td></tr>
                          )}
                       </tbody>
                    </table>

                    <div className="flex justify-end mt-2">
                       <table className="w-[45%] text-[12px] border-none">
                          <tbody>
                             <tr>
                                <td className="p-1 border-none">Nilai Kotor (Total Ongkos Trip)</td>
                                <td className="p-1 border-none text-right">Rp {slip.total_trip_ongkos.toLocaleString('id-ID')}</td>
                             </tr>
                             <tr>
                                <td className="p-1 border-none">Potongan Material</td>
                                <td className="p-1 border-none text-right text-red-600">- Rp {slip.potongan_material.toLocaleString('id-ID')}</td>
                             </tr>
                             <tr className="border-t-2 border-black font-bold">
                                <td className="p-1 border-none pt-2">Nilai Bersih Hak Vendor</td>
                                <td className="p-1 border-none text-right pt-2">Rp {nilaiBersihHakVendor.toLocaleString('id-ID')}</td>
                             </tr>
                             <tr>
                                <td className="p-1 border-none"><strong>Potongan Kasbon (Sesuai Mutasi)</strong></td>
                                <td className="p-1 border-none text-right text-red-600"><strong>- Rp {slip.potongan_kasbon.toLocaleString('id-ID')}</strong></td>
                             </tr>
                             <tr className="border-t-2 border-black font-bold">
                                <td className="p-1 border-none pt-2">Total Cash Keluar</td>
                                <td className="p-1 border-none text-right pt-2">Rp {totalCashKeluar.toLocaleString('id-ID')}</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>
                 </div>
               )
             })}
           </div>
        </div>
      )}
    </div>
  )
}
