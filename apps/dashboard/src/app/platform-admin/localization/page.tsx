'use client';
import {Globe2} from 'lucide-react';
import {PageHeading,Panel,StatCard,Status} from '@/components/platform/platform-ui';
import {SettingsEditor,useSettingValue} from '@/components/platform/settings-registry';

interface Currency {code?:string;symbol?:string;rate?:number;rounding?:number}
interface TaxRule {region?:string;label?:string;ratePercent?:number;inclusive?:boolean}

/**
 * Currency, locale, and tax are one operational concern: what a merchant in another
 * country is charged and in what language. The registry holds the values; this page
 * also renders them as tables, because a list of FX rates is unreadable as raw JSON.
 */
export default function Localization(){
 const base=useSettingValue<string>('localization.base_currency');
 const currencies=useSettingValue<Currency[]>('localization.enabled_currencies')||[];
 const taxRules=useSettingValue<TaxRule[]>('localization.tax_rules')||[];
 const taxEnabled=useSettingValue<boolean>('localization.tax_enabled');
 const locales=useSettingValue<string[]>('localization.supported_locales')||[];
 const timezone=useSettingValue<string>('localization.default_timezone');

 return <div>
  <PageHeading eyebrow="Revenue" title="Tax & currency" copy="What merchants are billed in, which locales the product speaks, and the tax applied per region." actions={<Status tone={taxEnabled?'success':'neutral'}>{taxEnabled?'Tax applied to invoices':'Tax not applied'}</Status>}/>

  <div className="platform-metrics">
   <StatCard label="Base currency" value={base||'—'} detail="Revenue reporting is normalised to this" tone="violet"/>
   <StatCard label="Billing currencies" value={currencies.length} detail="Available to merchants" tone="blue"/>
   <StatCard label="Locales" value={locales.length} detail={locales.join(', ')||'None configured'} tone="green"/>
   <StatCard label="Tax rules" value={taxRules.length} detail={timezone||'No timezone set'} tone="amber"/>
  </div>

  <div className="platform-grid equal">
   <Panel title="Currencies" copy="The rate converts one unit of the base currency into this one">
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Code</th><th>Symbol</th><th>Rate</th><th>Decimals</th></tr></thead><tbody>
     {currencies.map((currency,index)=><tr key={`${currency.code}-${index}`}>
      <td><strong>{currency.code||'—'}</strong>{currency.code===base&&<small>Base currency</small>}</td>
      <td>{currency.symbol||'—'}</td>
      <td>{typeof currency.rate==='number'?currency.rate:'—'}</td>
      <td>{typeof currency.rounding==='number'?currency.rounding:'—'}</td>
     </tr>)}
    </tbody></table>
    {!currencies.length&&<div className="platform-empty"><Globe2 size={20}/>No billing currencies configured.</div>}</div>
   </Panel>
   <Panel title="Tax rules" copy="Applied to platform invoices when tax is switched on">
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Region</th><th>Label</th><th>Rate</th><th>Pricing</th></tr></thead><tbody>
     {taxRules.map((rule,index)=><tr key={`${rule.region}-${index}`}>
      <td><strong>{rule.region||'—'}</strong></td>
      <td>{rule.label||'Tax'}</td>
      <td>{typeof rule.ratePercent==='number'?`${rule.ratePercent}%`:'—'}</td>
      <td>{rule.inclusive?'Tax inclusive':'Added at checkout'}</td>
     </tr>)}
    </tbody></table>
    {!taxRules.length&&<div className="platform-empty">No tax rules defined.</div>}</div>
   </Panel>
  </div>

  <SettingsEditor className="mt-4" categories={['localization']} title="Localization configuration" copy="Editing the currency or tax list here updates the tables above."/>
 </div>;
}
