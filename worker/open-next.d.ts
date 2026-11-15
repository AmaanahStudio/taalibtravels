// Het bestand ontstaat pas bij `opennextjs-cloudflare build`; wrangler lost het
// bij het bundelen op. Dit is alleen de vorm voor de typecheck.
declare module "../.open-next/worker.js" {
  const handler: {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  };
  export default handler;
}
