import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Text,
  useHostTheme,
} from "cursor/canvas";

type Kind = "existing" | "build" | "retire";

function Legend() {
  const theme = useHostTheme();
  const items: Array<{ kind: Kind; label: string }> = [
    { kind: "existing", label: "Existing" },
    { kind: "build", label: "To build" },
    { kind: "retire", label: "Retire" },
  ];

  return (
    <Row gap={16} align="center" wrap>
      {items.map((item) => {
        const style = boxStyle(item.kind, theme);
        return (
          <div key={item.kind}>
            <Row gap={8} align="center">
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: style.background,
                  border: style.border,
                }}
              />
              <Text size="small" tone="secondary">
                {item.label}
              </Text>
            </Row>
          </div>
        );
      })}
    </Row>
  );
}

function boxStyle(
  kind: Kind,
  theme: ReturnType<typeof useHostTheme>,
): { background: string; border: string } {
  switch (kind) {
    case "existing":
      return {
        background: theme.fill.tertiary,
        border: `1px solid ${theme.stroke.secondary}`,
      };
    case "build":
      return {
        background: theme.fill.secondary,
        border: `2px solid ${theme.accent.primary}`,
      };
    case "retire":
      return {
        background: theme.bg.editor,
        border: `1px dashed ${theme.stroke.secondary}`,
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function Box({
  title,
  subtitle,
  kind,
  wide,
}: {
  title: string;
  subtitle?: string;
  kind: Kind;
  wide?: boolean;
}) {
  const theme = useHostTheme();
  const style = boxStyle(kind, theme);

  return (
    <div
      style={{
        ...style,
        borderRadius: 6,
        padding: "10px 14px",
        minWidth: wide ? undefined : 160,
        width: wide ? "100%" : undefined,
        textAlign: "center",
      }}
    >
      <Text weight="semibold" size="small">
        {title}
      </Text>
      {subtitle ? (
        <Text size="small" tone="tertiary">
          {subtitle}
        </Text>
      ) : null}
    </div>
  );
}

function ArrowDown({ label }: { label?: string }) {
  const theme = useHostTheme();
  return (
    <Stack gap={2} style={{ alignItems: "center", padding: "2px 0" }}>
      <div
        style={{
          width: 1,
          height: 14,
          background: theme.stroke.secondary,
        }}
      />
      {label ? (
        <Text size="small" tone="tertiary">
          {label}
        </Text>
      ) : null}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `6px solid ${theme.stroke.secondary}`,
        }}
      />
    </Stack>
  );
}

function LayerLabel({ children }: { children: string }) {
  return (
    <Text
      size="small"
      tone="tertiary"
      weight="medium"
      style={{ minWidth: 88, textAlign: "right", paddingTop: 12 }}
    >
      {children}
    </Text>
  );
}

function TargetFlow() {
  const theme = useHostTheme();

  return (
    <Stack
      gap={0}
      style={{
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: 8,
        padding: 20,
        background: theme.bg.editor,
      }}
    >
      <Row gap={16} align="start">
        <LayerLabel>Users</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "center" }}>
          <Box title="Ops Users" subtitle="PCs · RMs · Operations" kind="existing" />
          <ArrowDown />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>Auth</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "center" }}>
          <Box
            title="Salesforce SSO"
            subtitle="Same model as cxsales.refloor.com"
            kind="existing"
          />
          <ArrowDown />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>UI</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "center" }}>
          <Box
            title="React Inventory Website"
            subtitle="inventory.refloor.com · Satellites · Projects · Status"
            kind="build"
          />
          <ArrowDown label="internal APIs" />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>Service</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "stretch" }}>
          <Box
            title="Inventory Service"
            subtitle="Consolidate · calculate availability · expose APIs · monitor"
            kind="build"
            wide
          />
          <ArrowDown />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>Cache</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "stretch" }}>
          <Grid columns={2} gap={10}>
            <Box
              title="Redis / SQL Cache"
              subtitle="Atomic updates · last-updated stamp"
              kind="build"
            />
            <Box
              title="Refresh Job"
              subtitle="Every 5 min · retry · keep last good"
              kind="build"
            />
          </Grid>
          <ArrowDown label="scheduled pull" />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>Integration</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "stretch" }}>
          <Box
            title="Azure Middleware APIs"
            subtitle="GetInventory · GetPurchaseOrders · Demand · GetInventoryByProject"
            kind="existing"
            wide
          />
          <ArrowDown />
        </Stack>
      </Row>

      <Row gap={16} align="start">
        <LayerLabel>Source</LayerLabel>
        <Stack gap={0} style={{ flex: 1, alignItems: "center" }}>
          <Box
            title="Business Central"
            subtitle="Inventory source of truth"
            kind="existing"
          />
        </Stack>
      </Row>
    </Stack>
  );
}

function TodayVsTarget() {
  const theme = useHostTheme();

  return (
    <Grid columns={2} gap={16}>
      <Stack
        gap={10}
        style={{
          border: `1px solid ${theme.stroke.tertiary}`,
          borderRadius: 8,
          padding: 16,
        }}
      >
        <Row justify="space-between" align="center">
          <Text weight="semibold">Today</Text>
          <Pill tone="warning" active={false}>
            Replace UI
          </Pill>
        </Row>
        <Box title="Ops Users" kind="existing" />
        <ArrowDown />
        <Box
          title="Power BI Inventory Dashboard"
          subtitle="Current experience"
          kind="retire"
        />
        <ArrowDown />
        <Box
          title="Azure Middleware / BC"
          subtitle="Direct or report-backed reads"
          kind="existing"
        />
      </Stack>

      <Stack
        gap={10}
        style={{
          border: `1px solid ${theme.stroke.tertiary}`,
          borderRadius: 8,
          padding: 16,
        }}
      >
        <Row justify="space-between" align="center">
          <Text weight="semibold">Target</Text>
          <Pill tone="info" active={false}>
            Build
          </Pill>
        </Row>
        <Box title="Ops Users" kind="existing" />
        <ArrowDown />
        <Box
          title="React Inventory Website"
          subtitle="inventory.refloor.com"
          kind="build"
        />
        <ArrowDown />
        <Box
          title="Inventory Service + Cache"
          subtitle="Refresh every 5 min"
          kind="build"
        />
        <ArrowDown />
        <Box
          title="Azure Middleware → BC"
          subtitle="Unchanged source APIs"
          kind="existing"
        />
      </Stack>
    </Grid>
  );
}

export default function InventoryArchitecture() {
  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 880 }}>
      <Stack gap={6}>
        <H1>Inventory Availability Flash</H1>
        <Text tone="secondary">
          Architecture: what exists vs what to build
        </Text>
      </Stack>

      <Legend />

      <H2>Today → Target</H2>
      <TodayVsTarget />

      <Divider />

      <H2>Target stack (detail)</H2>
      <Callout tone="info">
        Website talks only to Inventory Service. Service owns cache freshness
        and calls existing middleware — not Business Central directly.
      </Callout>
      <TargetFlow />

      <Divider />

      <H2>Build checklist</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill tone="info">New</Pill>}>
            Inventory Service
          </CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">Pull + consolidate middleware APIs</Text>
              <Text size="small">Calculate availability / readiness</Text>
              <Text size="small">Redis (preferred) or SQL cache</Text>
              <Text size="small">5-min refresh, retry, alerts</Text>
              <Text size="small">Internal APIs for the React app</Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill tone="info">New</Pill>}>
            React Website
          </CardHeader>
          <CardBody>
            <Stack gap={4}>
              <Text size="small">Satellites, Projects, Inventory Status</Text>
              <Text size="small">Search, filters, project readiness</Text>
              <Text size="small">Dark theme matching Power BI</Text>
              <Text size="small">Last Updated timestamp</Text>
              <Text size="small">Salesforce SSO + Azure App Service</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}
