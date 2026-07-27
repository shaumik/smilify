import Link from 'next/link';
import Icon from '../Icon';
import CodeBlock from './CodeBlock';
import CodeGroup from './CodeGroup';
import Snippet from './Snippet';
import { Tabs, Tab } from './Tabs';

// ---- Callouts ----------------------------------------------------------

function Callout({
  kind,
  icon,
  children,
}: {
  kind: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`callout callout-${kind}`}>
      <span className="callout-icon">
        <Icon name={icon} size={16} />
      </span>
      <div className="callout-body">{children}</div>
    </div>
  );
}

const Note = (p: { children: React.ReactNode }) => (
  <Callout kind="note" icon="info" {...p} />
);
const Info = (p: { children: React.ReactNode }) => (
  <Callout kind="info" icon="info" {...p} />
);
const Warning = (p: { children: React.ReactNode }) => (
  <Callout kind="warning" icon="warning" {...p} />
);
const Tip = (p: { children: React.ReactNode }) => (
  <Callout kind="tip" icon="lightbulb" {...p} />
);
const Check = (p: { children: React.ReactNode }) => (
  <Callout kind="check" icon="check" {...p} />
);
const Danger = (p: { children: React.ReactNode }) => (
  <Callout kind="danger" icon="warning" {...p} />
);

// ---- Cards -------------------------------------------------------------

function Card({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <span className="card-icon">
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="card-title">{title}</div>
      {children && <div className="card-body">{children}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card card-link">
        {body}
      </Link>
    );
  }
  return <div className="card">{body}</div>;
}

function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div className="card-group" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {children}
    </div>
  );
}

// ---- Accordions & disclosure ------------------------------------------

function Accordion({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="accordion" open={defaultOpen}>
      <summary>
        <Icon name="chevron-right" size={14} className="accordion-chevron" />
        {title}
      </summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
}

function AccordionGroup({ children }: { children: React.ReactNode }) {
  return <div className="accordion-group">{children}</div>;
}

function Expandable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="expandable">
      <summary>
        <Icon name="chevron-right" size={12} className="accordion-chevron" /> {title}
      </summary>
      <div className="expandable-body">{children}</div>
    </details>
  );
}

// ---- Steps -------------------------------------------------------------

function Steps({ children }: { children: React.ReactNode }) {
  return <div className="steps">{children}</div>;
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <div className="step-indicator">
        <span className="step-dot" />
        <span className="step-line" />
      </div>
      <div className="step-content">
        <div className="step-title">{title}</div>
        <div className="step-body">{children}</div>
      </div>
    </div>
  );
}

// ---- API field docs ----------------------------------------------------

function FieldDoc({
  name,
  kind,
  type,
  required,
  defaultValue,
  children,
}: {
  name: string;
  kind?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <code className="field-name">{name}</code>
        {kind && <span className="field-kind">{kind}</span>}
        {type && <span className="field-type">{type}</span>}
        {required && <span className="field-required">required</span>}
        {defaultValue !== undefined && (
          <span className="field-default">default: {defaultValue}</span>
        )}
      </div>
      {children && <div className="field-desc">{children}</div>}
    </div>
  );
}

function ParamField(props: {
  path?: string;
  query?: string;
  body?: string;
  header?: string;
  type?: string;
  required?: boolean;
  default?: string;
  children?: React.ReactNode;
}) {
  const kind = props.path ? 'path' : props.query ? 'query' : props.body ? 'body' : 'header';
  const name = props.path ?? props.query ?? props.body ?? props.header ?? '';
  return (
    <FieldDoc
      name={name}
      kind={kind}
      type={props.type}
      required={props.required}
      defaultValue={props.default}
    >
      {props.children}
    </FieldDoc>
  );
}

function ResponseField(props: {
  name: string;
  type?: string;
  required?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <FieldDoc name={props.name} type={props.type} required={props.required}>
      {props.children}
    </FieldDoc>
  );
}

// ---- Misc --------------------------------------------------------------

function Frame({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <figure className="frame">
      <div className="frame-content">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Tooltip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="tooltip" title={tip}>
      {children}
    </span>
  );
}

function Update({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="update">
      <div className="update-meta">
        <span className="update-label">{label}</span>
        {description && <span className="update-desc">{description}</span>}
      </div>
      <div className="update-body">{children}</div>
    </div>
  );
}

// ---- HTML element overrides -------------------------------------------

function heading(Tag: 'h2' | 'h3' | 'h4') {
  return function Heading({ id, children }: { id?: string; children?: React.ReactNode }) {
    return (
      <Tag id={id} className="heading">
        <a href={`#${id}`} className="heading-anchor" aria-label="Link to section">
          {children}
        </a>
      </Tag>
    );
  };
}

function Anchor({ href = '', children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = /^https?:\/\//.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...rest}>
        {children}
        <Icon name="external-link" size={11} className="external-icon" />
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

export const mdxComponents = {
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  a: Anchor,
  pre: CodeBlock,
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="doc-img" {...props} alt={props.alt ?? ''} />
  ),
  Note,
  Info,
  Warning,
  Tip,
  Check,
  Danger,
  Card,
  CardGroup,
  Accordion,
  AccordionGroup,
  Expandable,
  Steps,
  Step,
  ParamField,
  ResponseField,
  Frame,
  Tooltip,
  Update,
  Icon,
  Tabs,
  Tab,
  CodeGroup,
  Snippet,
};
