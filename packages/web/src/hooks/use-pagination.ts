// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState, useCallback } from "react";

interface UsePaginationOptions {
  pageSize?: number;
  debounceMs?: number;
}

interface UsePaginationReturn {
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  search: string;
  setSearch: (value: string) => void;
  debouncedSearch: string;
  totalPages: number;
  setTotal: React.Dispatch<React.SetStateAction<number>>;
  offset: number;
  reset: () => void;
}

export function usePagination(opts: UsePaginationOptions = {}): UsePaginationReturn {
  const { pageSize = 20, debounceMs = 400 } = opts;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);

  // Debounce search input and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  const reset = useCallback(() => {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setTotal(0);
  }, []);

  return {
    page,
    setPage,
    search,
    setSearch,
    debouncedSearch,
    totalPages,
    setTotal,
    offset,
    reset,
  };
}
