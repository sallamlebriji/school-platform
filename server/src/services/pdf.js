'use strict';
/**
 * Génération PDF aux couleurs de l'établissement (PDFKit, en streaming).
 */
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const NAVY = '#13254A', GOLD = '#B08D57', MUTED = '#8B93A7';

function base(res, tenant, filename, title) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title, Author: tenant.name } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  const color = tenant.primaryColor || NAVY;
  doc.roundedRect(50, 45, 44, 44, 10).fill(color);
  doc.fillColor('#fff').fontSize(16).text(tenant.name.split(' ').filter(w => w.length > 2).slice(-2).map(w => w[0]).join('').toUpperCase(), 50, 59, { width: 44, align: 'center' });
  doc.fillColor(NAVY).fontSize(14).text(tenant.name, 104, 50);
  doc.fillColor(MUTED).fontSize(9).text(`${tenant.city || ''} · Année scolaire ${tenant.schoolYear}`, 104, 70);
  doc.moveTo(50, 100).lineTo(545, 100).lineWidth(1.5).strokeColor(color).stroke();
  doc.moveDown(3);
  const ref = crypto.randomBytes(5).toString('hex').toUpperCase();
  doc.on('pageAdded', () => {});
  const footer = () => doc.fillColor(MUTED).fontSize(8).text(`${tenant.name} — Document généré par Athénée School OS · Réf. ${ref}`, 50, 790, { width: 495, align: 'center' });
  return { doc, footer, color };
}

function certificate(res, tenant, student, cls, director) {
  const { doc, footer } = base(res, tenant, `certificat-${student.matricule}.pdf`, 'Certificat de scolarité');
  doc.fillColor(NAVY).fontSize(24).text('Certificat de scolarité', 50, 140);
  doc.fillColor(MUTED).fontSize(10).text(`N° ${student.matricule}/${new Date().getFullYear()}`);
  doc.moveDown(2).fillColor('#111C33').fontSize(12)
    .text(`La direction de l'établissement ${tenant.name} certifie que l'élève :`, { lineGap: 6 })
    .moveDown()
    .font('Helvetica-Bold').text(`${student.firstName} ${student.lastName}`).font('Helvetica')
    .text(`Né(e) le ${new Date(student.birthDate).toLocaleDateString('fr-FR')} — matricule ${student.matricule}`)
    .moveDown()
    .text(`est régulièrement inscrit(e) en classe de ${cls ? cls.name : '—'} pour l'année scolaire ${tenant.schoolYear}.`, { lineGap: 6 })
    .moveDown()
    .text('Le présent certificat est délivré pour servir et valoir ce que de droit.');
  doc.moveDown(4).text(`Fait à ${tenant.city || ''}, le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
  doc.moveDown(0.5).font('Helvetica-Bold').text(director || 'La Direction', { align: 'right' }).font('Helvetica');
  doc.circle(140, 560, 55).lineWidth(2).strokeColor(GOLD).stroke();
  doc.fillColor(GOLD).fontSize(8).text(tenant.name.toUpperCase(), 90, 552, { width: 100, align: 'center' });
  footer();
  doc.end();
}

function reportCard(res, tenant, student, cls, averages, subjects) {
  const { doc, footer } = base(res, tenant, `bulletin-${student.matricule}.pdf`, 'Bulletin scolaire');
  doc.fillColor(NAVY).fontSize(22).text('Bulletin scolaire — Trimestre 1', 50, 130);
  doc.fillColor('#111C33').fontSize(11).text(`${student.firstName} ${student.lastName} · ${cls ? cls.name : ''} · ${student.matricule}`);
  let y = 190;
  doc.rect(50, y, 495, 22).fill('#F8F4EC');
  doc.fillColor('#4A556E').fontSize(9).text('MATIÈRE', 58, y + 7).text('COEF.', 330, y + 7).text('MOYENNE', 400, y + 7).text('APPRÉCIATION', 460, y + 7);
  y += 28;
  for (const [sid, v] of Object.entries((averages && averages.subjects) || {})) {
    const s = subjects[sid];
    doc.fillColor('#111C33').fontSize(10).text(s ? s.name : sid, 58, y).text(s ? String(s.coefficient) : '1', 330, y)
      .font('Helvetica-Bold').text(String(v.average).replace('.', ','), 400, y).font('Helvetica')
      .text(v.average >= 16 ? 'Excellent' : v.average >= 13 ? 'Bien' : v.average >= 10 ? 'Assez bien' : 'Insuffisant', 460, y);
    y += 20;
    doc.moveTo(50, y - 5).lineTo(545, y - 5).lineWidth(.5).strokeColor('#E9E4DA').stroke();
  }
  y += 16;
  doc.rect(50, y, 495, 56).fill('#F8F4EC');
  doc.fillColor(NAVY).fontSize(10).text('Moyenne générale', 64, y + 12).fontSize(22).text(averages && averages.general != null ? String(averages.general).replace('.', ',') : '—', 64, y + 26);
  if (averages && averages.rank) doc.fontSize(10).text('Rang', 260, y + 12).fontSize(22).text(`${averages.rank}/${averages.of}`, 260, y + 26);
  footer();
  doc.end();
}

function receipt(res, tenant, invoice, student, payment) {
  const { doc, footer } = base(res, tenant, `recu-${invoice.number}.pdf`, 'Reçu de paiement');
  const money = c => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${tenant.currency === 'MAD' ? 'DH' : tenant.currency}`;
  doc.fillColor(NAVY).fontSize(22).text('Reçu de paiement', 50, 130);
  doc.fillColor(MUTED).fontSize(10).text(`Facture ${invoice.number}`);
  doc.moveDown(2).fillColor('#111C33').fontSize(12)
    .text(`Élève : ${student.firstName} ${student.lastName} (${student.matricule})`)
    .text(`Libellé : ${invoice.label}`)
    .text(`Montant réglé : ${money(invoice.amountCents)}`)
    .text(`Mode : ${payment ? payment.method : '—'} · Date : ${payment ? new Date(payment.paidAt).toLocaleDateString('fr-FR') : '—'}`);
  doc.circle(470, 330, 45).lineWidth(2).strokeColor(GOLD).stroke();
  doc.fillColor(GOLD).fontSize(16).text('PAYÉ', 425, 322, { width: 90, align: 'center' });
  footer();
  doc.end();
}

module.exports = { certificate, reportCard, receipt };
