"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/lib/platform-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
export default function Revenue() {
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["revenue", period, search],
    queryFn: () => platformApi.revenue(period, search),
  });
  const s = data?.summary || {};
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue</h1>
        <p className="text-slate-400">
          Recorded PAID ledger amounts only. Refund transactions reduce net
          revenue.
        </p>
      </div>
      <div className="flex gap-3">
        <Input
          className="max-w-md border-slate-700 bg-slate-900"
          placeholder="Business or transaction reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-3"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {[
            "today",
            "7d",
            "30d",
            "this_month",
            "previous_month",
            "3m",
            "6m",
            "12m",
          ].map((x) => (
            <option key={x} value={x}>
              {x.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Net recorded revenue", s.revenue],
          ["New subscription revenue", s.newRevenue],
          ["Renewal revenue", s.renewalRevenue],
          ["Refunds", s.refunds],
        ].map(([l, v]) => (
          <Card key={l} className="border-slate-800 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400">{l}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {Number(v || 0).toLocaleString()} BDT
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              {[
                "Business",
                "Type",
                "Amount",
                "Status",
                "Provider",
                "Reference",
                "Paid",
                "Environment",
              ].map((x) => (
                <th className="p-4" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((t) => (
              <tr className="border-t border-slate-800" key={t._id}>
                <td className="p-4">{t.businessName || "Unknown"}</td>
                <td className="p-4">{t.type}</td>
                <td className="p-4">
                  {t.amount.toLocaleString()} {t.currency}
                </td>
                <td className="p-4">
                  <Badge>{t.status}</Badge>
                </td>
                <td className="p-4">{t.provider || "—"}</td>
                <td className="p-4">{t.providerReference || "—"}</td>
                <td className="p-4">
                  {t.paidAt ? new Date(t.paidAt).toLocaleString() : "—"}
                </td>
                <td className="p-4">{t.isTest ? "Test" : "Recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
