from django.core.cache import cache


def reserve_fixed_window(key, timeout):
    """Atomically reserve one attempt in a cache-backed fixed window."""
    while True:
        if cache.add(key, 1, timeout=timeout):
            return 1
        try:
            return cache.incr(key)
        except ValueError:
            # The key can expire between add() and incr(); retry in a new window.
            continue
