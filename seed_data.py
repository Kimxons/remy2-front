import os
import django

# 1. Setup Django environment
# Ensure 'config.settings' matches your actual settings path in the backend root
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings') 
django.setup()

from django.db import transaction
from orders.models import Category, SubjectArea

def seed():
    print("--- Starting Database Clean & Seed ---")
    
    try:
        with transaction.atomic():
            # 2. Clear existing data to prevent UUID/Primary Key mismatches
            # Always delete children (SubjectArea) before parents (Category)
            SubjectArea.objects.all().delete()
            Category.objects.all().delete()
            print("Successfully cleared old Categories and Subjects.")
            
            # 3. Define Categories based on your RemyInk Production UI
            categories_to_create = [
                "Business & Content",
                "IB Diploma Program",
                "Software & Design",
                "University & Academic"
            ]
            
            category_objs = {}
            for cat_name in categories_to_create:
                obj = Category.objects.create(name=cat_name)
                category_objs[cat_name] = obj
                print(f"Created Category: {cat_name}")

            # 4. Define Subjects for the IB Diploma Program
            # Using your academic focus areas: Economics, Physics, and English
            ib_subjects = ["Economics HL", "Physics SL", "English A", "Psychology"]
            for sub_name in ib_subjects:
                SubjectArea.objects.create(
                    category=category_objs["IB Diploma Program"], 
                    name=sub_name
                )
                print(f"Added IB Subject: {sub_name}")

            # 5. Define Subjects for Software & Design
            # Useful for your current development and deployment testing
            software_subjects = ["Full-Stack Dev", "Cloud Infrastructure", "Database Management"]
            for sub_name in software_subjects:
                SubjectArea.objects.create(
                    category=category_objs["Software & Design"], 
                    name=sub_name
                )
                print(f"Added Software Subject: {sub_name}")

        print("--- Seed Complete: Data is now aligned with Localhost ---")

    except Exception as e:
        print(f"Error during seeding: {e}")

if __name__ == '__main__':
    seed()