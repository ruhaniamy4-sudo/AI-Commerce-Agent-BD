'use client';
import {useState} from 'react';
import {PageHeading,TabBar} from '@/components/platform/platform-ui';
import {SettingsEditor,useSettingValue} from '@/components/platform/settings-registry';
import {TriangleAlert} from 'lucide-react';

type Section='platform'|'billing'|'subscription'|'integration'|'support'|'feature';
const TABS:Array<[Section,string]>=[
 ['platform','Platform & access'],
 ['billing','Billing'],
 ['subscription','Subscription policy'],
 ['integration','Integrations'],
 ['support','Support'],
];
const COPY:Record<Section,string>={
 platform:'Product identity, availability, and whether new merchants can sign themselves up.',
 billing:'Invoicing, collection, dunning, and what an operator may refund.',
 subscription:'How plans start, change, and end for merchants.',
 integration:'Which channels and couriers exist platform-wide, and how integrations behave.',
 support:'What merchants are offered when they need help.',
 feature:'Legacy feature switches. New capability gating lives in Feature flags.',
};

export default function Settings(){
 const [section,setSection]=useState<Section>('platform');
 const maintenance=useSettingValue<boolean>('platform.maintenance_mode');
 const signup=useSettingValue<boolean>('platform.signup_enabled');
 return <div>
  <PageHeading eyebrow="Configuration" title="Platform settings" copy="Every runtime knob the platform reads, editable here instead of in a deployment." />
  {maintenance&&<p className="platform-banner"><TriangleAlert size={14}/>Maintenance mode is on. Merchant and public API requests are being refused; this console stays reachable.</p>}
  {signup===false&&<p className="platform-banner info"><TriangleAlert size={14}/>Self-serve signup is closed. New workspaces have to be created by an operator.</p>}
  <TabBar tabs={TABS} active={section} onChange={setSection}/>
  <SettingsEditor categories={section==='platform'?['platform']:[section]} title={TABS.find(([value])=>value===section)?.[1]||'Settings'} copy={COPY[section]}/>
 </div>;
}
