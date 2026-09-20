type Props = {
  label: string;
  value: string;
};

export function PaymentRow({ label, value }: Props) {
  if (!value) return null;

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
