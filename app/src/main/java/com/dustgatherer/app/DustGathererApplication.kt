package com.dustgatherer.app

import android.app.Application
import com.dustgatherer.app.data.local.AppDatabase

class DustGathererApplication : Application() {
    val database: AppDatabase by lazy { AppDatabase.getDatabase(this) }
}
