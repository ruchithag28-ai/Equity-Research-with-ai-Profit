import CompanyProfitClient from './CompanyProfitClient';

const symbols = [
  'TCS', 'INFY', 'HCLTECH', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'SUNPHARMA', 'DRREDDY', 'CIPLA',
  'MARUTI', 'M&M', 'TATAMOTORS', 'HINDUNILVR', 'ITC', 'NESTLEIND', 'RELIANCE', 'NTPC',
  'POWERGRID', 'TATASTEEL', 'HINDALCO', 'JSWSTEEL', 'DLF', 'GODREJPROP', 'LODHA',
];

export const dynamicParams = false;
export function generateStaticParams() {
  return symbols.map((symbol) => ({ symbol }));
}

export default async function CompanyPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <CompanyProfitClient symbol={symbol} />;
}
