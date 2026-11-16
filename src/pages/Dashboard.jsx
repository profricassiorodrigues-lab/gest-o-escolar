import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  gerarPDFRelatorioGeral,
  gerarPDFBoletimIndividual,
} from '../utils/gerarPdf'

const ABAS = [
  { id: 'alunos', label: 'Alunos' },
  { id: 'frequencia', label: 'Lançar Frequência' },
  { id: 'notas', label: 'Lançar Notas' },
  { id: 'panorama', label: 'Panorama' },
]

export default function Dashboard() {
  const [abaAtiva, setAbaAtiva] = useState('alunos')

  async function handleSair() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">JOVENS TALENTOS</h1>
          <div className="flex items-center gap-4">
            <BotaoBackup />
            <button
              onClick={handleSair}
              className="text-sm text-gray-500 hover:text-gray-800 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Menu de abas */}
      <nav className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`py-3 text-sm whitespace-nowrap border-b-2 transition ${
                abaAtiva === aba.id
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {abaAtiva === 'alunos' && <Alunos />}
        {abaAtiva === 'frequencia' && <Frequencia />}
        {abaAtiva === 'notas' && <Notas />}
        {abaAtiva === 'panorama' && <Panorama />}
      </main>
    </div>
  )
}

function BotaoBackup() {
  const [exportando, setExportando] = useState(false)

  function converterParaCSV(linhas, colunas) {
    const cabecalho = colunas.join(',')

    const linhasFormatadas = linhas.map((linha) =>
      colunas
        .map((coluna) => {
          const valor = linha[coluna] ?? ''
          const texto = String(valor).replace(/"/g, '""')
          return `"${texto}"`
        })
        .join(',')
    )

    return [cabecalho, ...linhasFormatadas].join('\n')
  }

  function baixarArquivo(conteudo, nomeArquivo) {
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleExportar() {
    setExportando(true)

    const { data: alunos } = await supabase.from('alunos').select('*')
    const { data: notas } = await supabase
      .from('notas')
      .select('aluno_id, avaliacao, nota, data')
    const { data: frequencias } = await supabase
      .from('frequencias')
      .select('aluno_id, data, status')

    const mapaAlunos = {}
    ;(alunos || []).forEach((a) => {
      mapaAlunos[a.id] = { nome: a.nome, turma: a.turma }
    })

    const linhasNotas = (notas || []).map((n) => {
      const aluno = mapaAlunos[n.aluno_id] || { nome: 'Desconhecido', turma: '—' }
      return {
        Nome: aluno.nome,
        Turma: aluno.turma,
        Tipo: 'Nota',
        Data: n.data,
        Detalhe: n.avaliacao,
        Valor: n.nota,
      }
    })

    const linhasFrequencias = (frequencias || []).map((f) => {
      const aluno = mapaAlunos[f.aluno_id] || { nome: 'Desconhecido', turma: '—' }
      return {
        Nome: aluno.nome,
        Turma: aluno.turma,
        Tipo: 'Presença',
        Data: f.data,
        Detalhe: '',
        Valor: f.status === 'presente' ? 'Presente' : 'Falta',
      }
    })

    const todasAsLinhas = [...linhasNotas, ...linhasFrequencias].sort((a, b) => {
      if (a.Nome < b.Nome) return -1
      if (a.Nome > b.Nome) return 1
      return a.Data.localeCompare(b.Data)
    })

    const colunas = ['Nome', 'Turma', 'Tipo', 'Data', 'Detalhe', 'Valor']
    const csv = converterParaCSV(todasAsLinhas, colunas)

    const dataHoje = new Date().toISOString().slice(0, 10)
    baixarArquivo(csv, `jovens-talentos-backup-${dataHoje}.csv`)

    setExportando(false)
  }

  return (
    <button
      onClick={handleExportar}
      disabled={exportando}
      className="text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50"
    >
      {exportando ? 'Exportando...' : 'Exportar Backup (CSV)'}
    </button>
  )
}

function Cartao({ titulo, valor }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{titulo}</p>
      <p className="text-2xl font-semibold text-gray-800">{valor}</p>
    </div>
  )
}

function Alunos() {
  const [nome, setNome] = useState('')
  const [turma, setTurma] = useState('')
  const [alunos, setAlunos] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    carregarAlunos()
  }, [])

  async function carregarAlunos() {
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .order('nome', { ascending: true })
    if (!error) setAlunos(data)
  }

  function iniciarEdicao(aluno) {
    setEditandoId(aluno.id)
    setNome(aluno.nome)
    setTurma(aluno.turma)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setNome('')
    setTurma('')
  }

  async function handleSalvar(e) {
    e.preventDefault()
    setErro('')
    if (!nome.trim() || !turma.trim()) {
      setErro('Preencha nome e turma.')
      return
    }
    setSalvando(true)
    const { error } = editandoId
      ? await supabase.from('alunos').update({ nome, turma }).eq('id', editandoId)
      : await supabase.from('alunos').insert({ nome, turma })
    setSalvando(false)
    if (error) {
      setErro(editandoId ? 'Erro ao atualizar aluno.' : 'Erro ao cadastrar aluno.')
      return
    }
    cancelarEdicao()
    carregarAlunos()
  }

  async function handleExcluir(aluno) {
    const confirmado = window.confirm(
      `Excluir o aluno "${aluno.nome}"? Isso também apaga suas notas e frequências.`
    )
    if (!confirmado) return
    const { error } = await supabase.from('alunos').delete().eq('id', aluno.id)
    if (!error) carregarAlunos()
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSalvar}
        className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          placeholder="Nome do aluno"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Turma"
          value={turma}
          onChange={(e) => setTurma(e.target.value)}
          className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={salvando}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Cadastrar'}
        </button>
        {editandoId && (
          <button
            type="button"
            onClick={cancelarEdicao}
            className="text-sm text-gray-500 hover:text-gray-800 transition px-2"
          >
            Cancelar
          </button>
        )}
      </form>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Turma</th>
              <th className="px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-gray-400">
                  Nenhum aluno cadastrado ainda.
                </td>
              </tr>
            )}
            {alunos.map((aluno) => (
              <tr key={aluno.id} className="border-t border-gray-100">
                <td className="px-4 py-2 text-gray-800">{aluno.nome}</td>
                <td className="px-4 py-2 text-gray-600">{aluno.turma}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-3 justify-end text-xs">
                    <button
                      onClick={() => iniciarEdicao(aluno)}
                      className="text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(aluno)}
                      className="text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Frequencia() {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [turmaFiltro, setTurmaFiltro] = useState('')
  const [alunos, setAlunos] = useState([])
  const [registros, setRegistros] = useState({})
  const [turmas, setTurmas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState(null)

  useEffect(() => {
    carregarAlunosETurmas()
  }, [])

  useEffect(() => {
    if (alunos.length > 0) carregarFrequenciaDoDia()
  }, [data, alunos])

  async function carregarAlunosETurmas() {
    const { data: lista } = await supabase.from('alunos').select('*').order('nome')
    if (lista) {
      setAlunos(lista)
      const turmasUnicas = [...new Set(lista.map((a) => a.turma))]
      setTurmas(turmasUnicas)
    }
    setCarregando(false)
  }

  async function carregarFrequenciaDoDia() {
    const { data: freq } = await supabase
      .from('frequencias')
      .select('aluno_id, status')
      .eq('data', data)
    const mapa = {}
    if (freq) freq.forEach((f) => (mapa[f.aluno_id] = f.status))
    setRegistros(mapa)
  }

  async function marcar(alunoId, status) {
    setSalvandoId(alunoId)
    const { error } = await supabase
      .from('frequencias')
      .upsert({ aluno_id: alunoId, data, status }, { onConflict: 'aluno_id,data' })
    setSalvandoId(null)
    if (!error) {
      setRegistros((prev) => ({ ...prev, [alunoId]: status }))
    }
  }

  const alunosFiltrados = turmaFiltro ? alunos.filter((a) => a.turma === turmaFiltro) : alunos

  if (carregando) return <p className="text-gray-400 text-sm">Carregando...</p>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col sm:flex-row gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Turma</label>
          <select
            value={turmaFiltro}
            onChange={(e) => setTurmaFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as turmas</option>
            {turmas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Turma</th>
              <th className="px-4 py-2 font-medium">Presença</th>
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-gray-400">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
            {alunosFiltrados.map((aluno) => {
              const statusAtual = registros[aluno.id]
              return (
                <tr key={aluno.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{aluno.nome}</td>
                  <td className="px-4 py-2 text-gray-600">{aluno.turma}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => marcar(aluno.id, 'presente')}
                        disabled={salvandoId === aluno.id}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                          statusAtual === 'presente'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                        }`}
                      >
                        Presente
                      </button>
                      <button
                        onClick={() => marcar(aluno.id, 'falta')}
                        disabled={salvandoId === aluno.id}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                          statusAtual === 'falta'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                        }`}
                      >
                        Falta
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Notas() {
  const [alunos, setAlunos] = useState([])
  const [alunoId, setAlunoId] = useState('')
  const [avaliacao, setAvaliacao] = useState('')
  const [nota, setNota] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [ultimosLancamentos, setUltimosLancamentos] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarAlunos()
    carregarUltimosLancamentos()
  }, [])

  async function carregarAlunos() {
    const { data: lista } = await supabase.from('alunos').select('*').order('nome')
    if (lista) setAlunos(lista)
  }

  async function carregarUltimosLancamentos() {
    const { data: lista } = await supabase
      .from('notas')
      .select('id, avaliacao, nota, data, alunos(nome)')
      .order('created_at', { ascending: false })
      .limit(10)
    if (lista) setUltimosLancamentos(lista)
  }

  async function handleLancar(e) {
    e.preventDefault()
    setErro('')
    if (!alunoId || !avaliacao.trim() || nota === '') {
      setErro('Preencha aluno, avaliação e nota.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('notas').insert({
      aluno_id: alunoId,
      avaliacao,
      nota: Number(nota),
      data,
    })
    setSalvando(false)
    if (error) {
      setErro('Erro ao lançar nota.')
      return
    }
    setAvaliacao('')
    setNota('')
    carregarUltimosLancamentos()
  }

  async function handleExcluir(lancamento) {
    const confirmado = window.confirm(
      `Excluir o lançamento "${lancamento.avaliacao}" de ${lancamento.alunos?.nome}?`
    )
    if (!confirmado) return
    const { error } = await supabase.from('notas').delete().eq('id', lancamento.id)
    if (!error) carregarUltimosLancamentos()
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleLancar}
        className="bg-white rounded-lg border border-gray-200 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Aluno</label>
          <select
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Avaliação</label>
          <input
            type="text"
            placeholder="Ex: Prova 1"
            value={avaliacao}
            onChange={(e) => setAvaliacao(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nota</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={salvando}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Lançar Nota'}
          </button>
        </div>
      </form>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div>
        <p className="text-sm text-gray-500 mb-2">Últimos lançamentos</p>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Aluno</th>
                <th className="px-4 py-2 font-medium">Avaliação</th>
                <th className="px-4 py-2 font-medium">Nota</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {ultimosLancamentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-gray-400">
                    Nenhum lançamento ainda.
                  </td>
                </tr>
              )}
              {ultimosLancamentos.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{l.alunos?.nome}</td>
                  <td className="px-4 py-2 text-gray-600">{l.avaliacao}</td>
                  <td className="px-4 py-2 text-gray-600">{l.nota}</td>
                  <td className="px-4 py-2 text-gray-600">{l.data}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleExcluir(l)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Panorama() {
  const [alunos, setAlunos] = useState([])
  const [notasPorAluno, setNotasPorAluno] = useState({})
  const [freqPorAluno, setFreqPorAluno] = useState({})
  const [alunoSelecionado, setAlunoSelecionado] = useState('')
  const [turmaFiltro, setTurmaFiltro] = useState('')
  const [turmas, setTurmas] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    setCarregando(true)
    const { data: listaAlunos } = await supabase.from('alunos').select('*').order('nome')
    const { data: notas } = await supabase.from('notas').select('aluno_id, nota, avaliacao, data')
    const { data: frequencias } = await supabase
      .from('frequencias')
      .select('aluno_id, status, data')

    const mapaNotas = {}
    if (notas) {
      notas.forEach((n) => {
        if (!mapaNotas[n.aluno_id]) mapaNotas[n.aluno_id] = []
        mapaNotas[n.aluno_id].push(n)
      })
    }

    const mapaFreq = {}
    if (frequencias) {
      frequencias.forEach((f) => {
        if (!mapaFreq[f.aluno_id]) mapaFreq[f.aluno_id] = []
        mapaFreq[f.aluno_id].push(f)
      })
    }

    setAlunos(listaAlunos || [])
    setNotasPorAluno(mapaNotas)
    setFreqPorAluno(mapaFreq)
    if (listaAlunos) {
      setTurmas([...new Set(listaAlunos.map((a) => a.turma))])
    }
    setCarregando(false)
  }

  function calcularMedia(alunoId) {
    const lista = notasPorAluno[alunoId]
    if (!lista || lista.length === 0) return null
    const soma = lista.reduce((acc, n) => acc + Number(n.nota), 0)
    return soma / lista.length
  }

  function calcularPresenca(alunoId) {
    const lista = freqPorAluno[alunoId]
    if (!lista || lista.length === 0) return null
    const presentes = lista.filter((f) => f.status === 'presente').length
    return (presentes / lista.length) * 100
  }

  if (carregando) return <p className="text-gray-400 text-sm">Carregando...</p>

  const aluno = alunos.find((a) => a.id === alunoSelecionado)
  const alunosFiltrados = turmaFiltro ? alunos.filter((a) => a.turma === turmaFiltro) : alunos

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col sm:flex-row gap-3 print:hidden">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Aluno</label>
          <select
            value={alunoSelecionado}
            onChange={(e) => setAlunoSelecionado(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os alunos</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>

        {!alunoSelecionado && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Turma</label>
            <select
              value={turmaFiltro}
              onChange={(e) => setTurmaFiltro(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!alunoSelecionado && (
        <RelatorioGeral
          alunos={alunosFiltrados}
          calcularMedia={calcularMedia}
          calcularPresenca={calcularPresenca}
          turmaFiltro={turmaFiltro}
        />
      )}

      {alunoSelecionado && aluno && (
        <BoletimIndividual
          aluno={aluno}
          notas={notasPorAluno[aluno.id] || []}
          frequencias={freqPorAluno[aluno.id] || []}
          media={calcularMedia(aluno.id)}
          presenca={calcularPresenca(aluno.id)}
        />
      )}
    </div>
  )
}

function RelatorioGeral({ alunos, calcularMedia, calcularPresenca, turmaFiltro }) {
  const medias = alunos.map((a) => calcularMedia(a.id)).filter((m) => m !== null)
  const presencas = alunos.map((a) => calcularPresenca(a.id)).filter((p) => p !== null)

  const mediaGeral = medias.length > 0 ? medias.reduce((a, b) => a + b, 0) / medias.length : null
  const presencaMedia =
    presencas.length > 0 ? presencas.reduce((a, b) => a + b, 0) / presencas.length : null

  function handleBaixarRelatorioGeral() {
    const linhas = alunos.map((a) => {
      const media = calcularMedia(a.id)
      const presenca = calcularPresenca(a.id)
      return [
        a.nome,
        a.turma,
        media !== null ? media.toFixed(1) : '—',
        presenca !== null ? `${presenca.toFixed(0)}%` : '—',
      ]
    })

    const nomeTurmaArquivo = turmaFiltro
      ? turmaFiltro.toLowerCase().replace(/\s+/g, '-')
      : 'todas-turmas'

    gerarPDFRelatorioGeral({
      titulo: 'Relatório Geral de Desempenho',
      subtitulo: turmaFiltro ? `Turma: ${turmaFiltro}` : 'Todas as turmas',
      mediaGeral,
      presencaMedia,
      linhas,
      nomeArquivo: `relatorio-geral-${nomeTurmaArquivo}.pdf`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Relatório Geral {turmaFiltro ? `— ${turmaFiltro}` : ''}
        </h2>
        <button
          onClick={handleBaixarRelatorioGeral}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Baixar Relatório (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Cartao
          titulo="Média Geral da Seleção"
          valor={mediaGeral !== null ? mediaGeral.toFixed(1) : '—'}
        />
        <Cartao
          titulo="% de Frequência Média"
          valor={presencaMedia !== null ? `${presencaMedia.toFixed(0)}%` : '—'}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Turma</th>
              <th className="px-4 py-2 font-medium">Média</th>
              <th className="px-4 py-2 font-medium">% Presença</th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-gray-400">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
            {alunos.map((a) => {
              const media = calcularMedia(a.id)
              const presenca = calcularPresenca(a.id)
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{a.nome}</td>
                  <td className="px-4 py-2 text-gray-600">{a.turma}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {media !== null ? media.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {presenca !== null ? `${presenca.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BoletimIndividual({ aluno, notas, frequencias, media, presenca }) {
  function handleBaixarBoletim() {
    gerarPDFBoletimIndividual({
      aluno,
      media,
      presenca,
      notas,
      frequencias,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Boletim Individual</h2>
        <button
          onClick={handleBaixarBoletim}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Baixar Boletim (PDF)
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="mb-4">
          <p className="text-lg font-semibold text-gray-800">{aluno.nome}</p>
          <p className="text-sm text-gray-500">Turma: {aluno.turma}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <Cartao titulo="Média Final" valor={media !== null ? media.toFixed(1) : '—'} />
          <Cartao
            titulo="% de Frequência"
            valor={presenca !== null ? `${presenca.toFixed(0)}%` : '—'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Avaliações</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Avaliação</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {notas.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-gray-400">
                      Sem notas lançadas.
                    </td>
                  </tr>
                )}
                {notas.map((n, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{n.avaliacao}</td>
                    <td className="px-3 py-2 text-gray-600">{n.data}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{n.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Presença</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {frequencias.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-gray-400">
                      Sem registros de presença.
                    </td>
                  </tr>
                )}
                {frequencias.map((f, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-600">{f.data}</td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        f.status === 'presente' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {f.status === 'presente' ? 'Presente' : 'Falta'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
