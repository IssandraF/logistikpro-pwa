import { format } from "date-fns";
import { id } from "date-fns/locale";
import { generateTerbilangText } from "@/lib/print-utils";
import type { SlipPembayaran, Trip, GrupMobil, ProyekLokasi, LokasiProyek } from "@/lib/db";

interface PrintSlipProps {
  slip: SlipPembayaran;
  trips: Trip[];
  grupMobil: GrupMobil;
  proyekLokasis: ProyekLokasi[];
  lokasiProyeks: LokasiProyek[];
}

export default function PrintSlip({
  slip,
  trips,
  grupMobil,
  proyekLokasis,
  lokasiProyeks
}: PrintSlipProps) {
  
  // Rute group calculation (for the summary table)
  const groupedTrips: Record<string, Trip[]> = {};
  trips.forEach(t => {
    const pl = proyekLokasis.find(x => x.id === t.proyek_lokasi_id);
    const loc = pl ? lokasiProyeks.find(x => x.id === pl.lokasi_proyek_id) : null;
    const rute = loc ? loc.nama_lokasi : 'TIDAK DIKETAHUI';
    
    if (!groupedTrips[rute]) groupedTrips[rute] = [];
    groupedTrips[rute].push(t);
  });

  // Calculate min and max dates
  const dates = trips.map(t => new Date(t.tanggal_bongkar).getTime());
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
  const periode = minDate && maxDate 
    ? `${format(minDate, 'dd/MM/yyyy')} - ${format(maxDate, 'dd/MM/yyyy')}`
    : '-';

  return (
    <div className="hidden print:block printable-invoice">
      <div className="text-center font-bold underline mb-5 text-[18px]">SLIP PEMBAYARAN</div>

      <table className="info-table w-full mb-5 border-none">
        <tbody>
          <tr>
            <td className="w-[15%] border-none p-1">Dibayarkan Kepada</td>
            <td className="w-[45%] border-none p-1">: <span className="font-bold">{grupMobil.nama_grup.toUpperCase()}</span></td>
            <td className="w-[15%] text-right border-none p-1">Nomor Slip</td>
            <td className="w-[25%] border-none p-1">: {slip.nomor_slip}</td>
          </tr>
          <tr>
            <td className="border-none p-1">PIC / Telp</td>
            <td className="border-none p-1">: {(grupMobil.nama_pic || '-').toUpperCase()} / {grupMobil.no_hp || '-'}</td>
            <td className="text-right border-none p-1">Tanggal Cetak</td>
            <td className="border-none p-1">: {format(new Date(slip.tanggal), 'EEEE, dd MMMM yyyy', { locale: id })}</td>
          </tr>
          <tr>
            <td className="border-none p-1">Status</td>
            <td className="border-none p-1">: {slip.status.toUpperCase()}</td>
            <td className="text-right border-none p-1">Periode Trip</td>
            <td className="border-none p-1">: {periode}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-2">Rincian Trip & Ritase:</p>

      <table className="main-table w-full mb-4">
        <thead>
          <tr>
            <th className="w-[5%]">NO</th>
            <th className="w-[45%] text-left pl-2">RUTE (LOKASI MUAT - BONGKAR)</th>
            <th className="w-[15%]">TOTAL VOL (M3)</th>
            <th className="w-[10%]">RITASE</th>
            <th className="w-[25%] text-right pr-2">SUBTOTAL (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedTrips).map(([rute, routeTrips], idx) => {
            const volTotal = routeTrips.reduce((sum, t) => sum + t.volume, 0);
            const hargaSatu = routeTrips[0].harga_bayar;
            const subtot = volTotal * hargaSatu;
            return (
              <tr key={rute}>
                <td className="text-center">{idx + 1}</td>
                <td className="text-left font-bold pl-2">{rute.toUpperCase()}</td>
                <td className="text-center">{volTotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="text-center">{routeTrips.length}x rit</td>
                <td className="text-right pr-2">Rp {subtot.toLocaleString('id-ID')}</td>
              </tr>
            );
          })}
          
          <tr className="font-bold bg-[#f9f9f9]">
            <td colSpan={4} className="text-right pr-2">TOTAL NILAI TRIP (KOTOR)</td>
            <td className="text-right pr-2">Rp {slip.total_trip_ongkos.toLocaleString('id-ID')}</td>
          </tr>
          
          {slip.potongan_material > 0 && (
            <tr className="font-bold text-red-600">
              <td colSpan={4} className="text-right pr-2">POTONGAN MATERIAL (-)</td>
              <td className="text-right pr-2">- Rp {slip.potongan_material.toLocaleString('id-ID')}</td>
            </tr>
          )}
          
          <tr className="font-bold text-red-600">
            <td colSpan={4} className="text-right pr-2">POTONGAN HUTANG / KAS BON (-)</td>
            <td className="text-right pr-2">- Rp {slip.potongan_kasbon.toLocaleString('id-ID')}</td>
          </tr>
          
          <tr className="font-bold bg-[#e0f7fa]">
            <td colSpan={4} className="text-right pr-2 text-[14px]">TOTAL DIBAYARKAN (BERSIH)</td>
            <td className="text-right pr-2 text-[14px] text-[#00796b]">Rp {slip.total_bersih_dibayar.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-5 italic bg-[#fffde7] p-4 border border-dashed border-black">
        <strong>Terbilang:</strong> <br/>
        {generateTerbilangText(slip.total_bersih_dibayar)}
      </div>

      <table className="w-full mt-12 border-none">
        <tbody>
          <tr>
            <td className="w-[50%] text-center border-none">
              Mengetahui / Menyetujui,<br/><br/><br/><br/><br/>
              <strong className="underline">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</strong><br/>
              <span className="text-[11px] text-gray-600">Pihak Perusahaan / Keuangan</span>
            </td>
            <td className="w-[50%] text-center border-none">
              Penerima Dana,<br/><br/><br/><br/><br/>
              <strong className="underline">{(grupMobil.nama_pic || '..........................................').toUpperCase()}</strong><br/>
              <span className="text-[11px] text-gray-600">Ketua Grup / Vendor</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="page-break-before-always" style={{ pageBreakBefore: 'always', marginTop: '40px' }}>
        <div className="text-center font-bold text-[14px] mb-5 underline">
          LAMPIRAN RINCIAN PER TRIP
        </div>

        {Object.entries(groupedTrips).map(([lokasi, tripsInLokasi]) => {
          const tripsSorted = [...tripsInLokasi].sort((a, b) => a.plat_nomor.localeCompare(b.plat_nomor));
          let noTripLokasi = 1;

          return (
            <div key={lokasi}>
              <div className="font-bold mb-1 pt-2">LOKASI BONGKAR: {lokasi.toUpperCase()}</div>
              
              <table className="table-bordered info-table w-full mb-5">
                <thead className="bg-[#00B0F0] text-black">
                  <tr>
                    <th className="w-[5%]">NO</th>
                    <th className="w-[15%]">TANGGAL</th>
                    <th className="w-[15%]">PLAT NOMOR</th>
                    <th className="w-[15%]">VOLUME (M3)</th>
                    <th className="w-[15%]">HARGA/M3</th>
                    <th className="w-[15%]">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {tripsSorted.map(t => (
                    <tr key={t.id}>
                      <td className="text-center">{noTripLokasi++}</td>
                      <td className="text-center">{format(new Date(t.tanggal_bongkar), 'dd/MM/yyyy')}</td>
                      <td className="text-center font-bold">{t.plat_nomor}</td>
                      <td className="text-center">{t.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-right pr-2">Rp {t.harga_bayar.toLocaleString('id-ID')}</td>
                      <td className="text-right pr-2 font-bold">Rp {(t.volume * t.harga_bayar).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#f0f0f0] font-bold">
                    <td colSpan={3} className="text-center">SUBTOTAL LOKASI {lokasi.toUpperCase()} ({tripsSorted.length} Rit)</td>
                    <td className="text-center">{tripsSorted.reduce((s, x) => s + x.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-center">-</td>
                    <td className="text-right pr-2 text-green-700">Rp {tripsSorted.reduce((s, x) => s + (x.volume * x.harga_bayar), 0).toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

    </div>
  );
}
