import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function criarBasePDF(titulo, subtitulo) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const larguraPagina = doc.internal.pageSize.getWidth()

  // Cabeçalho azul institucional
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, larguraPagina, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(String(titulo), 14, 13)

  if (subtitulo) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(String(subtitulo), 14, 21)
  }

  return doc
}

function adicionarRodapeTodasPaginas(doc) {
  const totalPaginas = doc.internal.getNumberOfPages()
  const larguraPagina = doc.internal.pageSize.getWidth()
  const alturaPagina = doc.internal.pageSize.getHeight()
  const dataAtual = new Date().toLocaleDateString('pt-BR')
  const horaAtual = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      `Gestão Escolar • Gerado em ${dataAtual} às ${horaAtual}`,
      14,
      alturaPagina - 10
    )
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      larguraPagina - 14,
      alturaPagina - 10,
      { align: 'right' }
    )
  }
}

export function gerarPDFRelatorioGeral({
  titulo,
  subtitulo,
  mediaGeral,
  presencaMedia,
  linhas,
  nomeArquivo,
}) {
  const doc = criarBasePDF(titulo, subtitulo)

  // Caixa de resumo (Média Geral e Frequência Média)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, 34, 182, 16, 2, 2, 'FD')

  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Média Geral da Seleção: ${mediaGeral !== null ? mediaGeral.toFixed(1) : '—'}`,
    20,
    44
  )
  doc.text(
    `Frequência Média: ${presencaMedia !== null ? `${presencaMedia.toFixed(0)}%` : '—'}`,
    115,
    44
  )

  // Tabela de alunos (quebra páginas automaticamente e repete o cabeçalho)
  autoTable(doc, {
    startY: 56,
    head: [['Nome do Aluno', 'Turma', 'Média', '% Presença']],
    body: linhas.length > 0 ? linhas : [['Nenhum aluno encontrado.', '', '', '']],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      valign: 'middle',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 20, bottom: 20, left: 14, right: 14 },
  })

  adicionarRodapeTodasPaginas(doc)
  doc.save(nomeArquivo)
}

export function gerarPDFBoletimIndividual({
  aluno,
  media,
  presenca,
  notas,
  frequencias,
}) {
  const doc = criarBasePDF(
    `Boletim Individual — ${aluno.nome}`,
    `Turma: ${aluno.turma}`
  )

  // Caixa de resumo do aluno
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, 34, 182, 16, 2, 2, 'FD')

  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.text(`Média Final: ${media !== null ? media.toFixed(1) : '—'}`, 20, 44)
  doc.text(
    `Frequência: ${presenca !== null ? `${presenca.toFixed(0)}%` : '—'}`,
    115,
    44
  )

  // Seção 1: Avaliações
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Avaliações e Notas', 14, 60)

  const linhasNotas =
    notas.length > 0
      ? notas.map((n) => [n.avaliacao, n.data, Number(n.nota).toFixed(1)])
      : [['Sem notas lançadas.', '—', '—']]

  autoTable(doc, {
    startY: 64,
    head: [['Avaliação', 'Data', 'Nota']],
    body: linhasNotas,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 20, bottom: 20, left: 14, right: 14 },
  })

  // Seção 2: Histórico de Presença (começa logo abaixo da tabela de notas)
  const posicaoAposNotas = doc.lastAutoTable.finalY + 12

  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Registros de Frequência', 14, posicaoAposNotas)

  const linhasFreq =
    frequencias.length > 0
      ? frequencias.map((f) => [
          f.data,
          f.status === 'presente' ? 'Presente' : 'Falta',
        ])
      : [['Sem registros de presença.', '—']]

  autoTable(doc, {
    startY: posicaoAposNotas + 4,
    head: [['Data', 'Status']],
    body: linhasFreq,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 20, bottom: 20, left: 14, right: 14 },
  })

  adicionarRodapeTodasPaginas(doc)
  const nomeLimpo = aluno.nome.toLowerCase().replace(/\s+/g, '-')
  doc.save(`boletim-${nomeLimpo}.pdf`)
}
