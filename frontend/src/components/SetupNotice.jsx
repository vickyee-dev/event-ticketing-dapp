import { CHAIN } from "../lib/config";
import { Panel } from "./ui";

const Code = ({ children }) => (
  <code className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
);

export default function SetupNotice() {
  const local = CHAIN.id === 31337;
  return (
    <Panel className="mt-10 max-w-2xl">
      <h2 className="font-display text-2xl font-bold">Contract not deployed yet</h2>
      <p className="mt-2 text-sm text-muted">
        The app is pointed at {CHAIN.name} but no contract address is configured for it.
      </p>
      <ol className="mt-5 grid list-decimal gap-3 pl-5 text-sm">
        {local ? (
          <>
            <li>
              Start a local chain: <Code>npm run node</Code>
            </li>
            <li>
              In another terminal, deploy: <Code>npm run deploy:local</Code>
            </li>
            <li>
              Optional demo data: <Code>npm run seed:local</Code>
            </li>
          </>
        ) : (
          <>
            <li>
              Add a funded testnet <Code>PRIVATE_KEY</Code> to the root <Code>.env</Code>
            </li>
            <li>
              Deploy: <Code>npm run deploy:fuji</Code>
            </li>
          </>
        )}
        <li>
          Restart the dev server (or set <Code>VITE_CONTRACT_ADDRESS</Code> in <Code>frontend/.env</Code>).
        </li>
      </ol>
    </Panel>
  );
}
