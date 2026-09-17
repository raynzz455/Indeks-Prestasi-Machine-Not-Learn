"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton shown while the optimize API is running. */
export function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary skeleton */}
      <Card className="border-2">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card/50 px-3 py-2.5 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts skeleton */}
      <div className="grid lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scenario skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
