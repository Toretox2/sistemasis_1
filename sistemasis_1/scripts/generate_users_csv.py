#!/usr/bin/env python3
"""Generador de CSV de usuarios con tokens QR.

Uso:
  python scripts/generate_users_csv.py --count 50 --out users.csv

El CSV resultante contiene columnas: id (uuid), nombre, qr_token
"""
import csv
import uuid
import secrets
import argparse

def generate_user(i):
    return {
        'id': str(uuid.uuid4()),
        'nombre': f'Usuario {i+1}',
        'qr_token': secrets.token_urlsafe(12)
    }

def main():
    parser = argparse.ArgumentParser(description='Genera un CSV de usuarios con tokens QR')
    parser.add_argument('--count', '-n', type=int, default=10, help='Número de usuarios a generar')
    parser.add_argument('--out', '-o', type=str, default='users.csv', help='Archivo de salida CSV')
    args = parser.parse_args()

    rows = [generate_user(i) for i in range(args.count)]

    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id','nombre','qr_token'])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    print(f'Generados {args.count} usuarios en {args.out}')

if __name__ == '__main__':
    main()
