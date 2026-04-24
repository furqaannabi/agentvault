export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', letterSpacing: '0.1em' }}>
        [ PROOF/{id} — LOADING ]
      </p>
    </main>
  )
}
